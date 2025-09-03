import supabase from '../supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

export const checkNearbyPotholes = async (req, res) => {
    const { lat, lng, radius } = req.query;
        const searchRadius = radius || 50;


    if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    try {
        const { data, error } = await supabase.rpc('find_potholes_nearby', {
            lat_input: parseFloat(lat),
            lng_input: parseFloat(lng),
            radius_meters: parseFloat(searchRadius)
        });
        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Error checking for nearby potholes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// --- NEW: Function to handle the actual pothole reporting ---
export const reportPothole = async (req, res) => {
    // Data from the form (already verified by middleware)
    const { lat, lng, description, severity, user_id } = req.body; // user_id is optional
    const imageFile = req.file;

    try {
        // --- 1. Upload Image to Supabase Storage ---
        const fileName = `${user_id || 'anonymous'}/${uuidv4()}-${imageFile.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('pothole-images') // Make sure you have a bucket named 'pothole-images'
            .upload(fileName, imageFile.buffer, {
                contentType: imageFile.mimetype,
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            throw uploadError;
        }
        
        // Get the public URL of the uploaded image
        const { data: { publicUrl } } = supabase.storage
            .from('pothole-images')
            .getPublicUrl(fileName);


        // --- 2. Save Pothole Details to the Database ---
        // Build insert payload and only include user_id if provided
        const potholeInsert = {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            description: description,
            severity: severity,
            status: 'reported',
        };

        if (user_id) {
            potholeInsert.user_id = user_id;
        }

        const { data: potholeData, error: potholeError } = await supabase
            .from('potholes')
            .insert([potholeInsert])
            .select() // Use .select() to get the newly created pothole record back
            .single(); // We expect only one record back

        if (potholeError) {
            throw potholeError;
        }
        
        // --- 3. Link Image to the Pothole in the 'images' table ---
        // Determine image type with robust fallback attempts
        const candidateTypes = [
            process.env.IMAGE_DEFAULT_TYPE,
            'original',
            'before',
            'after',
        ].filter(Boolean);

        let imageError = null;
        for (const candidate of candidateTypes) {
            const { error: attemptError } = await supabase
                .from('images')
                .insert([
                    {
                        pothole_id: potholeData.id,
                        image_url: publicUrl,
                        type: candidate,
                    }
                ]);
            if (!attemptError) {
                imageError = null;
                break;
            }
            imageError = attemptError;
            // If enum mismatch or not-null, try next candidate; otherwise break
            if (attemptError?.code !== '22P02' && attemptError?.code !== '23502') {
                break;
            }
        }

        if (imageError) {
            const tried = candidateTypes.join(', ');
            throw new Error(`Failed to insert image with any allowed type. Tried: ${tried}. Ensure your images.type enum contains one of these or set IMAGE_DEFAULT_TYPE to a valid value.`);
        }


        res.status(201).json({ message: "Pothole reported successfully!", data: potholeData });

    } catch (error) {
        console.error("Error reporting pothole:", error);
        // Provide clearer guidance for common enum/nullable issues
        if (error?.code === '22P02') {
            return res.status(400).json({
                error: 'Invalid image type value. Set IMAGE_DEFAULT_TYPE in Backend/.env to a valid enum option for images.type.'
            });
        }
        if (error?.code === '23502') {
            return res.status(500).json({
                error: 'images.type is required by the database. Set IMAGE_DEFAULT_TYPE in Backend/.env to a valid enum option.'
            });
        }
        const errorMessage = error?.message || 'Failed to report pothole.';
        res.status(500).json({ error: errorMessage });
    }
};

export const getAllPotholes = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('potholes')
            .select(`
                id,
                latitude,
                longitude,
                description,
                severity,
                status,
                images ( image_url )
            `);

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching all potholes:", error);
        res.status(500).json({ error: 'Failed to fetch potholes.' });
    }
};