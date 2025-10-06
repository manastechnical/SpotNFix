import supabase from '../supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';
import { detectPotholeSeverity, imageBufferToBase64 } from '../services/geminiService.js';
import { sendPotholeStatusEmail } from '../utils/sendPotholeStatusEmail.js';
import { sendPotholeFixedEmail } from '../utils/sendPotholeFixedEmail.js';
import { sendRepairRejectedEmail } from '../utils/sendRepairRejectedEmail.js';
import { sendPotholeReappearedEmail } from '../utils/sendPotholeReappearedEmail.js';

export const checkNearbyPotholes = async (req, res) => {
    const { lat, lng, radius } = req.query;
    const searchRadius = radius || 50;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    try {
        // const { data, error } = await supabase.rpc('find_potholes_nearby', {
        //     lat_input: parseFloat(lat),
        //     lng_input: parseFloat(lng),
        //     radius_meters: parseFloat(searchRadius)
        // });
        // if (error) {
        //     throw error;
        // }
        throw new Error("Simulated RPC failure for testing fallback");
        res.status(200).json(data);
    } catch (error) {
        // console.error('RPC failed for nearby potholes, attempting fallback:', error);
        console.error('RPC failed for nearby potholes, attempting fallback:');

        // Fallback: Bounding box + haversine filter in JS
        try {
            const centerLat = parseFloat(lat);
            const centerLng = parseFloat(lng);
            const radiusMeters = parseFloat(searchRadius);

            // Approximate bounding box in degrees
            const metersPerDegreeLat = 111_320;
            const metersPerDegreeLng = 111_320 * Math.cos(centerLat * Math.PI / 180);
            const dLat = radiusMeters / metersPerDegreeLat;
            const dLng = radiusMeters / metersPerDegreeLng;

            const minLat = centerLat - dLat;
            const maxLat = centerLat + dLat;
            const minLng = centerLng - dLng;
            const maxLng = centerLng + dLng;

            const { data: boxData, error: boxError } = await supabase
                .from('potholes')
                .select(`id, latitude, longitude, description, severity, status, bids (
                            id,
                            contractor_id,
                            contracts (
                                id,
                                status
                            )
                        )`)
                .gte('latitude', minLat)
                .lte('latitude', maxLat)
                .gte('longitude', minLng)
                .lte('longitude', maxLng);

            if (boxError) {
                throw boxError;
            }

            const toRad = (deg) => deg * Math.PI / 180;
            const earthRadiusM = 6_371_000;
            const filtered = (boxData || []).filter((p) => {
                if (p.latitude == null || p.longitude == null) return false;
                const dLatRad = toRad(p.latitude - centerLat);
                const dLngRad = toRad(p.longitude - centerLng);
                const a = Math.sin(dLatRad / 2) ** 2 +
                    Math.cos(toRad(centerLat)) * Math.cos(toRad(p.latitude)) *
                    Math.sin(dLngRad / 2) ** 2;
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = earthRadiusM * c;
                return distance <= radiusMeters;
            });

            return res.status(200).json(filtered);
        } catch (fallbackError) {
            console.error('Fallback failed for nearby potholes:', fallbackError);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
};

export const reportPothole = async (req, res) => {
    // Data from the form (already verified by middleware)
    const { lat, lng, description, severity, user_id } = req.body; // Assuming you'll send user_id from frontend
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
        const { data: potholeData, error: potholeError } = await supabase
            .from('potholes')
            .insert([
                {
                    user_id: user_id,
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng),
                    description: description,
                    severity: severity,
                    status: 'reported',
                },
            ])
            .select()
            .single();

        if (potholeError) {
            throw potholeError;
        }

        // --- NEW: 3. Update the pothole's location using the RPC function ---
        const { error: rpcError } = await supabase.rpc('update_pothole_location', {
            pothole_id_input: potholeData.id
        });

        if (rpcError) {
            // It's better to log this error but not fail the whole request,
            // as the main data is already saved.
            console.error('Error updating pothole location:', rpcError);
        }


        // --- 4. Link Image to the Pothole in the 'images' table ---
        const { error: imageError } = await supabase
            .from('images')
            .insert([
                {
                    pothole_id: potholeData.id,
                    image_url: publicUrl,
                    type: 'before_repair',
                }
            ]);

        if (imageError) {
            throw imageError;
        }

        res.status(201).json({ message: "Pothole reported successfully!", data: potholeData });

    } catch (error) {
        console.error("Error reporting pothole:", error);
        // If something fails, you might want to clean up the uploaded image
        // (code for cleanup not included here for simplicity)
        res.status(500).json({ error: 'Failed to report pothole.' });
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
        verify,
        images (
            image_url,
            type
        ),
        bids (
            id,
            amount,
            description,
            status,
            contractor_id,
            users (
                name,
                email
            ),
            contracts (
            id,
                bid_id,
                status,
                start_date,
                expected_end_date,
                actual_end_date
            )
        )
            `)
            .order('id');

        if (error) throw error;

        // Transform the data to include the current (lowest) bid
        const transformedData = data.map(pothole => ({
            ...pothole,
            current_bid: pothole.bids && pothole.bids.length > 0
                ? pothole.bids.reduce((lowest, current) =>
                    current.amount < lowest.amount ? current : lowest
                    , pothole.bids[0])
                : null
        }));

        res.status(200).json(transformedData);
    } catch (error) {
        console.error("Error fetching all potholes:", error);
        res.status(500).json({
            error: 'Failed to fetch potholes.',
            details: error.message
        });
    }
};

export const verifyPothole = async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('potholes')
            .update({ verify: true })
            .eq('id', id)
            .select(`
                *,
                users (
                    id,
                    email
                )
            `)
            .single(); // .single() to return the updated record

        if (error) {
            if (error.code === 'PGRST116') { // Error code for "No rows found"
                return res.status(404).json({ error: 'Pothole not found.' });
            }
            throw error;
        }

        if (data.users?.email) {
            console.log("email", data.users.email);
            await sendPotholeStatusEmail(data.users.email, 'verified');
        }
        res.status(200).json({ message: 'Pothole verified successfully!', data });

    } catch (error) {
        console.error('Error verifying pothole:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// New function to verify pothole with severity detection
export const verifyPotholeWithSeverity = async (req, res) => {
    const { id } = req.params;

    try {
        // First, get the pothole and its associated image
        const { data: potholeData, error: fetchError } = await supabase
            .from('potholes')
            .select(`
                id,
                latitude,
                longitude,
                description,
                severity,
                status,
                verify,
                images (
                    image_url,
                    type
                )
            `)
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Pothole not found.' });
            }
            throw fetchError;
        }

        // Check if pothole has an image
        if (!potholeData.images || potholeData.images.length === 0) {
            return res.status(400).json({ error: 'No image found for this pothole.' });
        }

        // Get the first image URL
        const imageUrl = potholeData.images[0].image_url;
        
        // Fetch the image from Supabase storage
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }
        
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const imageBase64 = imageBufferToBase64(imageBuffer, 'image/jpeg');
        
        // Detect severity using Gemini
        console.log(`[Backend] Detecting severity for pothole ${id}...`);
        const detectedSeverity = await detectPotholeSeverity(imageBase64, 'image/jpeg');
        
        // Update the pothole with verification and detected severity
        const { data: updatedData, error: updateError } = await supabase
            .from('potholes')
            .update({ 
                verify: true,
                severity: detectedSeverity
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        res.status(200).json({ 
            message: 'Pothole verified and severity detected successfully!', 
            data: updatedData,
            detectedSeverity: detectedSeverity
        });

    } catch (error) {
        console.error('Error verifying pothole with severity:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// --- NEW: Function to discard a pothole ---
export const discardPothole = async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('potholes')
            .update({ status: 'discarded' })
            .eq('id', id)
            .select(`
                *,
                users (
                    id,
                    email
                )
            `)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Pothole not found.' });
            }
            throw error;
        }

        if (data.users?.email) {
            console.log("email", data.users.email);
            await sendPotholeStatusEmail(data.users.email, 'rejected');
        }
        res.status(200).json({ message: 'Pothole discarded successfully!', data });

    } catch (error) {
        console.error('Error discarding pothole:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const finalizePotholeRepair = async (req, res) => {

    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Pothole ID is required.' });
    }

    try {
        const { data, error } = await supabase
            .from('potholes')
            .update({ status: 'fixed' })
            .eq('id', id)
            .select(`*,
                users (
                    id,
                    email
                )`)
            .single();

        // If the RPC call returns an error (e.g., pothole not found)
        if (data?.users?.email) {
            console.log("email", data.users.email);
            await sendPotholeFixedEmail(data.users.email, data.description);

        } else {
            console.warn("Could not send 'pothole fixed' email: User email not found.");
        }
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Pothole not found.' });
            }
            throw error; // Throw other errors to be caught by the catch block
        }

        // Send the updated pothole data back as a success response
        res.status(200).json({
            message: 'Pothole repair finalized successfully.',
            pothole: data,
        });

    } catch (error) {
        console.error('Error finalizing pothole repair:', error.message);
        res.status(500).json({ error: 'An unexpected error occurred on the server.' });
    }
};

export const rejectPotholeRepair = async (req, res) => {
    const { id } = req.params; // This is the contract ID from the URL

    if (!id) {
        return res.status(400).json({ error: 'Contract ID is required.' });
    }

    try {
        // Step 1: Update contract and get the associated contractor_id
        const { data: contractData, error: contractError } = await supabase
            .from('contracts')
            .update({ status: 'ongoing' })
            .eq('id', id)
            .select(`*, bids(contractor_id,            
                users (
                email
            ))`)
            .single();

        if (contractError) {
            if (contractError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Contract not found.' });
            }
            throw contractError;
        }

        if (contractData?.bids?.users?.email) {
            console.log("email", contractData.bids.users.email);

            const contractorEmail = contractData.bids.users.email;
            const potholeDescription = "";

            await sendRepairRejectedEmail(contractorEmail, potholeDescription);

        } else {
            console.warn("Could not send 'repair rejected' email: Contractor email not found.");
        }
        const contractorId = contractData.bids?.contractor_id;
        if (!contractorId) {
            return res.status(404).json({ error: 'Could not find the contractor for this contract.' });
        }

        // Step 2: Manually increment the contractor's penalty count

        // 2a. First, READ the current penalty count
        const { data: contractorDetails, error: fetchError } = await supabase
            .from('contractor_details')
            .select('no_of_penalty')
            .eq('user_id', contractorId)
            .single();

        if (fetchError) {
            console.error('Failed to fetch penalty count:', fetchError);
            // Even if this fails, we should still proceed with rejecting the repair
        }

        // 2b. Then, WRITE the new incremented value
        const currentPenalties = contractorDetails?.no_of_penalty || 0;
        const { error: updateError } = await supabase
            .from('contractor_details')
            .update({ no_of_penalty: currentPenalties + 1 })
            .eq('user_id', contractorId);

        if (updateError) {
            // Log this error but do not stop the process, as the main rejection is more critical
            console.error('Failed to update penalty count:', updateError);
        }

        // Step 3: Fetch the contractor's email from the 'users' table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('email')
            .eq('id', contractorId)
            .single();

        if (userError) {
            console.error('Failed to fetch contractor email:', userError);
        }

        const contractorEmail = userData ? userData.email : null;

        // Step 4: Send the final success response
        res.status(200).json({
            message: 'Pothole repair rejected and contractor penalized.',
            contract: contractData,
            contractorEmail: contractorEmail
        });

    } catch (error) {
        console.error('Error rejecting pothole repair:', error.message);
        res.status(500).json({ error: 'An unexpected error occurred on the server.' });
    }
};


export const reportDuplicatePothole = async (req, res) => {
    // 1. Get IDs from URL parameters
    const { potholeId, contractId } = req.params;
    const imageFile = req.file;
    const { user_id } = req.body; // Assuming user_id is sent for naming the file

    if (!imageFile) {
        return res.status(400).json({ error: 'Image file is required.' });
    }

    try {
        // --- 2. Find and delete the old image from Supabase Storage ---
        const { data: imageData, error: findImageError } = await supabase
            .from('images')
            .select('image_url')
            .eq('pothole_id', potholeId)
            .single(); // Assuming one image per pothole for simplicity

        if (findImageError) {
            console.warn("Could not find a previous image to delete, proceeding with upload.", findImageError.message);
        }

        if (imageData) {
            // Extract the file path from the full URL
            const oldImageUrl = new URL(imageData.image_url);
            const oldImageFilePath = oldImageUrl.pathname.split('/pothole-images/')[1];

            if (oldImageFilePath) {
                const { error: deleteError } = await supabase.storage
                    .from('pothole-images')
                    .remove([oldImageFilePath]);

                if (deleteError) {
                    console.error("Failed to delete old image, but proceeding:", deleteError);
                    // Decide if this is a critical error. For now, we'll continue.
                }
            }
        }

        // --- 3. Upload the new image to Supabase Storage ---
        const fileName = `${user_id || 'anonymous'}/${uuidv4()}-${imageFile.originalname}`;
        const { error: uploadError } = await supabase.storage
            .from('pothole-images')
            .upload(fileName, imageFile.buffer, {
                contentType: imageFile.mimetype,
                cacheControl: '3600',
                upsert: false, // Don't upsert, as it's a new file
            });

        console.log(fileName);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('pothole-images')
            .getPublicUrl(fileName);


        // --- 4. Update the 'images' table with the new URL ---
        // This will replace the old image record if one exists, or add a new one.
        const { error: imageDbError } = await supabase
            .from('images')
            .update({ image_url: publicUrl })
            .eq('pothole_id', potholeId);                   //wants to fix this since it only updates if there is already an image

        if (imageDbError) throw imageDbError;


        // --- 5. Update pothole status to 'reopened' ---
        const { data: potholeData, error: potholeError } = await supabase
            .from('potholes')
            .update({ status: 'reopened' })
            .eq('id', potholeId)
            .select()
            .single();

        if (potholeError) throw potholeError;



        res.status(200).json({
            message: "Pothole re-reported successfully and contract penalized.",
            data: potholeData
        });

    } catch (error) {
        console.error("Error reporting duplicate pothole:", error);
        res.status(500).json({ error: 'Failed to report duplicate pothole.' });
    }
};

export const discardReopen = async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('potholes')
            .update({ status: 'fixed' }) // Status is now 'fixed'
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Pothole not found.' });
            }
            throw error;
        }

        // Updated success message
        res.status(200).json({ message: 'Reopened claim discarded and pothole status set to fixed.', data });

    } catch (error) {
        console.error('Error in discardReopen:', error); // Updated log message
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const penalizeReopen = async (req, res) => {
    // In a real app, you would have authentication middleware here.

    const { id } = req.params; // Get the contract ID from the URL
    console.log("Penalizing contract ID:", id);
    if (!id) {
        return res.status(400).json({ error: 'Contract ID is required.' });
    }

    try {
        // Find the contract by its ID and update its status to 'penalized'.
        const { data, error } = await supabase
            .from('contracts')
            .update({ status: 'penalized' }) // Status is now 'penalized'
            .eq('id', id)
            .select(`*, bids(contractor_id,            
                users (
                email
            ))`)
            .single();

        if (data?.bids?.users?.email) {

            const contractorEmail = data.bids.users.email;
            const potholeDescription = "";

            console.log("Found contractor email:", contractorEmail);

            await sendPotholeReappearedEmail(contractorEmail, potholeDescription);

        } else {
            console.warn("Could not send 'pothole reappeared' email: Required data (email or description) is missing.");
        }

        if (error) {
            // "PGRST116" is the code for a query that returns 0 rows, meaning the contract wasn't found.
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Contract not found.' });
            }
            throw error; // Let the catch block handle other errors.
        }
        const contractorId = data.bids?.contractor_id;
        if (!contractorId) {
            return res.status(404).json({ error: 'Could not find the contractor for this contract.' });
        }

        // Step 2: Manually increment the contractor's penalty count

        // 2a. First, READ the current penalty count
        const { data: contractorDetails, error: fetchError } = await supabase
            .from('contractor_details')
            .select('no_of_penalty')
            .eq('user_id', contractorId)
            .single();

        if (fetchError) {
            console.error('Failed to fetch penalty count:', fetchError);
            // Even if this fails, we should still proceed with rejecting the repair
        }

        // 2b. Then, WRITE the new incremented value
        const currentPenalties = contractorDetails?.no_of_penalty || 0;
        const { error: updateError } = await supabase
            .from('contractor_details')
            .update({ no_of_penalty: currentPenalties + 1 })
            .eq('user_id', contractorId);

        if (updateError) {
            // Log this error but do not stop the process, as the main rejection is more critical
            console.error('Failed to update penalty count:', updateError);
        }

        // Step 3: Fetch the contractor's email from the 'users' table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('email')
            .eq('id', contractorId)
            .single();

        if (userError) {
            console.error('Failed to fetch contractor email:', userError);
        }

        const contractorEmail = userData ? userData.email : null;

        // Send the updated contract data back as a success response.
        res.status(200).json({
            message: 'Contract has been penalized.',
            contract: data,
        });

    } catch (error) {
        console.error('Error penalizing contract:', error.message);
        res.status(500).json({ error: 'An unexpected error occurred on the server.' });
    }
};

// New function to detect severity from uploaded image
export const detectSeverityFromImage = async (req, res) => {
    try {
        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided." });
        }

        const imageFile = req.file;
        const imageBuffer = imageFile.buffer;
        const imageBase64 = imageBufferToBase64(imageBuffer, imageFile.mimetype);
        
        // Detect severity using Gemini
        console.log(`[Backend] Detecting severity from uploaded image...`);
        const detectedSeverity = await detectPotholeSeverity(imageBase64, imageFile.mimetype);
        
        res.status(200).json({ 
            success: true,
            severity: detectedSeverity,
            message: 'Severity detected successfully'
        });

    } catch (error) {
        console.error('Error detecting severity from image:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to detect severity',
            severity: 'Medium' // Fallback severity
        });
    }
};

export const reportDuplicatePotholeDiscarded = async (req, res) => {
    // 1. Get IDs from URL parameters
    const { potholeId } = req.params;
    const imageFile = req.file;
    const { user_id } = req.body; // Assuming user_id is sent for naming the file
    console.log("Re-reportingincrement_penalty discarded pothole ID:", potholeId);
    if (!imageFile) {
        return res.status(400).json({ error: 'Image file is required.' });
    }

    try {
        // --- 2. Find and delete the old image from Supabase Storage ---
        const { data: imageData, error: findImageError } = await supabase
            .from('images')
            .select('image_url')
            .eq('pothole_id', potholeId)
            .single(); // Assuming one image per pothole for simplicity

        if (findImageError) {
            console.warn("Could not find a previous image to delete, proceeding with upload.", findImageError.message);
        }

        if (imageData) {
            // Extract the file path from the full URL
            const oldImageUrl = new URL(imageData.image_url);
            const oldImageFilePath = oldImageUrl.pathname.split('/pothole-images/')[1];

            if (oldImageFilePath) {
                const { error: deleteError } = await supabase.storage
                    .from('pothole-images')
                    .remove([oldImageFilePath]);

                if (deleteError) {
                    console.error("Failed to delete old image, but proceeding:", deleteError);
                    // Decide if this is a critical error. For now, we'll continue.
                }
            }
        }

        // --- 3. Upload the new image to Supabase Storage ---
        const fileName = `${user_id || 'anonymous'}/${uuidv4()}-${imageFile.originalname}`;
        const { error: uploadError } = await supabase.storage
            .from('pothole-images')
            .upload(fileName, imageFile.buffer, {
                contentType: imageFile.mimetype,
                cacheControl: '3600',
                upsert: false, // Don't upsert, as it's a new file
            });

        console.log(fileName);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('pothole-images')
            .getPublicUrl(fileName);


        // --- 4. Update the 'images' table with the new URL ---
        // This will replace the old image record if one exists, or add a new one.
        const { error: imageDbError } = await supabase
            .from('images')
            .update({ image_url: publicUrl })
            .eq('pothole_id', potholeId);                   //wants to fix this since it only updates if there is already an image

        if (imageDbError) throw imageDbError;


        // --- 5. Update pothole status to 'reopened' ---
        const { data: potholeData, error: potholeError } = await supabase
            .from('potholes')
            .update({ status: 'reported' })
            .eq('id', potholeId)
            .select()
            .single();

        if (potholeError) throw potholeError;



        res.status(200).json({
            message: "Pothole re-reported successfully and contract penalized.",
            data: potholeData
        });

    } catch (error) {
        console.error("Error reporting duplicate pothole:", error);
        res.status(500).json({ error: 'Failed to report duplicate pothole.' });
    }
};