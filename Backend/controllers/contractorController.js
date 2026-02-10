import { v4 as uuidv4 } from 'uuid'; // Ensure you have this imported
import supabase from '../supabaseClient.js';
import exifParser from 'exif-parser';
import axios from 'axios';
import FormData from 'form-data';

// Helper function to calculate the distance between two GPS coordinates in kilometers
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

export const potholeFixed = async (req, res) => {
    // 1. Get IDs and File from the request
    const { bidId } = req.params;
    const { potholeId } = req.body; 
    const imageFile = req.file; // The repair proof image

    // 2. Validate inputs
    if (!bidId || !potholeId) {
        return res.status(400).json({ error: 'Bid ID and Pothole ID are required.' });
    }
    if (!imageFile) {
        return res.status(400).json({ error: 'Repair proof image is required.' });
    }

    try {
        // --- 3. Fetch pothole location for geolocation validation ---
        const { data: potholeRow, error: potholeError } = await supabase
            .from('potholes')
            .select('latitude, longitude')
            .eq('id', potholeId)
            .single();

        if (potholeError || !potholeRow) {
            if (potholeError?.code === 'PGRST116') {
                return res.status(404).json({ error: 'Pothole not found for the given ID.' });
            }
            console.error('Error fetching pothole for geolocation check:', potholeError);
            return res.status(500).json({ error: 'Failed to verify repair location.' });
        }

        // --- 4. Geolocation check using image EXIF vs pothole coordinates ---
        try {
            const parser = exifParser.create(imageFile.buffer);
            const exifData = parser.parse();

            const photoLat = exifData.tags.GPSLatitude;
            const photoLng = exifData.tags.GPSLongitude;

            if (!photoLat || !photoLng) {
                // Image has no GPS data or it could not be read
                return res.status(400).json({ error: 'Geolocation does not match' });
            }

            const distanceKm = calculateDistanceKm(
                potholeRow.latitude,
                potholeRow.longitude,
                photoLat,
                photoLng
            );

            // Allow a 100-meter tolerance for GPS inaccuracies
            if (!Number.isFinite(distanceKm) || distanceKm > 0.1) {
                return res.status(400).json({ error: 'Geolocation does not match' });
            }
        } catch (exifError) {
            console.error('EXIF Parsing Error (contractor proof):', exifError);
            return res.status(400).json({ error: 'Geolocation does not match' });
        }

        // --- 5. ML check: verify that no potholes are visible in the proof image ---
        try {
            const mlBaseUrl = process.env.ML_SERVER_URL || 'http://localhost:5001';
            const formData = new FormData();
            formData.append('image', imageFile.buffer, {
                filename: imageFile.originalname,
                contentType: imageFile.mimetype,
            });

            const mlResponse = await axios.post(`${mlBaseUrl}/detect`, formData, {
                headers: formData.getHeaders(),
                timeout: 15000,
            });

            const { data: mlData } = mlResponse;
            if (mlData && mlData.success && mlData.detected) {
                // Model still sees potholes in the "fixed" image -> block completion
                return res.status(400).json({ error: 'potholes visible in the image' });
            }
        } catch (mlError) {
            // If ML service fails, log but do not change existing behaviour of allowing completion
            console.error('Error calling ML detect service for contractor proof:', mlError?.message || mlError);
        }

        // --- 6. Upload Image to Supabase Storage ('fixed_pothole' bucket) ---
        // We use a unique name just like in reportPothole
        const fileName = `${potholeId}/${uuidv4()}-${imageFile.originalname}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('fixed_pothole') // Uploading to the requested bucket
            .upload(fileName, imageFile.buffer, {
                contentType: imageFile.mimetype,
                cacheControl: '3600',
                upsert: false,
            });
        if (uploadError) {
            console.error("Upload Error:", uploadError);
            return res.status(500).json({ error: 'Failed to upload repair image.' });
        }

        // --- 7. Get the Public URL ---
        const { data: { publicUrl } } = supabase.storage
            .from('fixed_pothole')
            .getPublicUrl(fileName);


        // --- 8. Database Updates (Sequential) ---

        // A. Update the contract status to 'completed'
        const { data: contractData, error: contractError } = await supabase
            .from('contracts')
            .update({
                status: 'completed',
                actual_end_date: new Date().toISOString(),
            })
            .eq('bid_id', bidId)
            .select()
            .single();

        if (contractError) {
            // Check specifically if the contract wasn't found
            if (contractError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Contract not found for the given bid ID.' });
            }
            throw contractError;
        }

        // B. Update the pothole status to 'under_review'
        const { data: potholeData, error: potholeStatusError } = await supabase
            .from('potholes')
            .update({ status: 'under_review' })
            .eq('id', potholeId)
            .select()
            .single();

        if (potholeStatusError) {
            console.error('Error updating pothole status to under_review:', potholeStatusError);
            return res.status(500).json({ error: 'Contract updated, but failed to update pothole status.' });
        }

        // C. Update the images table with the new URI
        // We find the image record associated with this pothole_id and update the completed_img_url
        const { data: imageData, error: imageError } = await supabase
            .from('images')
            .update({ 
                completed_img_url: publicUrl,
                type: 'fix_proof' // Setting the new URI here
            })
            .eq('pothole_id', potholeId)
            .select();

        if (imageError) {
            console.error("Image Table Update Error:", imageError);
            // We don't fail the whole request here since the main workflow (Contract/Pothole status) succeeded,
            // but we log it. You might want to return a warning.
        }
        
        // 9. Send success response
        return res.status(200).json({
            message: 'Work marked as complete, image uploaded, and case is now under review.',
            contract: contractData,
            pothole: potholeData,
            proof_image: publicUrl
        });

    } catch (error) {
        console.error("Error in potholeFixed controller:", error.message);
        return res.status(500).json({ 
            error: 'An internal server error occurred.',
            details: error.message 
        });
    }
};