import { v4 as uuidv4 } from 'uuid'; // Ensure you have this imported
import supabase from '../supabaseClient.js';

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
        // --- 3. Upload Image to Supabase Storage ('fixed_pothole' bucket) ---
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
        // --- 4. Get the Public URL ---
        const { data: { publicUrl } } = supabase.storage
            .from('fixed_pothole')
            .getPublicUrl(fileName);


        // --- 5. Database Updates (Sequential) ---

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
        const { data: potholeData, error: potholeError } = await supabase
            .from('potholes')
            .update({ status: 'under_review' })
            .eq('id', potholeId)
            .select()
            .single();

        if (potholeError) {
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
        
        // 6. Send success response
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