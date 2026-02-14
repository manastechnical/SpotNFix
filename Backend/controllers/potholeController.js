import supabase from '../supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';
import { detectPotholeSeverity, detectPotholeSeverityAndType, imageBufferToBase64 } from '../services/geminiService.js';
import { sendPotholeStatusEmail } from '../utils/sendPotholeStatusEmail.js';
import { sendPotholeFixedEmail } from '../utils/sendPotholeFixedEmail.js';
import { sendRepairRejectedEmail } from '../utils/sendRepairRejectedEmail.js';
import { sendPotholeReappearedEmail } from '../utils/sendPotholeReappearedEmail.js';
import { sendBlacklistEmail } from '../utils/sendBlacklistEmail.js';

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
    const { lat, lng, description, severity, pothole_type, user_id } = req.body; // Assuming you'll send user_id from frontend
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
                    pothole_type: pothole_type || 'Standard road damage',
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
                pothole_type,
                status,
                verify,
                images (
                    image_url,
                    type,
                    completed_img_url
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
            // Sort bids by amount (Ascending) directly in DB query
            .order('amount', { foreignTable: 'bids', ascending: true })
            .order('id', { ascending: true }); // Sort potholes by ID

        if (error) throw error;

        // Transform data
        const transformedData = data.map(pothole => ({
            ...pothole,
            // Since we sorted in query, the first bid is the lowest
            current_bid: pothole.bids && pothole.bids.length > 0 
                ? pothole.bids[0] 
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
            sendPotholeStatusEmail(data.users.email, 'verified');
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
                pothole_type,
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

        // Detect severity and type using Gemini
        console.log(`[Backend] Detecting severity and type for pothole ${id}...`);
        const { severity: detectedSeverity, type: detectedType } = await detectPotholeSeverityAndType(imageBase64, 'image/jpeg');

        // Update the pothole with verification, detected severity, and type
        const { data: updatedData, error: updateError } = await supabase
            .from('potholes')
            .update({
                verify: true,
                severity: detectedSeverity,
                pothole_type: detectedType
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
            sendPotholeStatusEmail(data.users.email, 'rejected');
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
            sendPotholeFixedEmail(data.users.email, data.description);

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

const getIdsToDelete = (bids) => {
    // We use reduce to accumulate just the IDs that match your logic
    return bids.reduce((acc, bid) => {

        // 1. CHECK: Is the bid pending?
        if (bid.status === 'pending') {
            acc.push(bid.pothole_id);
        }

        // 2. CHECK: Is the bid accepted?
        else if (bid.status === 'accepted') {
            // If accepted, check inside the contracts array for 'ongoing' status
            const hasOngoingContract = bid.contracts && bid.contracts.some(
                (contract) => contract.status === 'ongoing' || contract.status === 'penalized'
            );

            // If we found an ongoing contract, add the ID to our list
            if (hasOngoingContract) {
                acc.push(bid.pothole_id);
            }
        }

        return acc;
    }, []);
};

export const rejectPotholeRepair = async (req, res) => {
    const { id, potholeId } = req.params;

    // Validation
    if (!id || !potholeId) {
        return res.status(400).json({ error: 'Contract ID is required.' });
    }

    try {
        // --- STEP 1: Update Contract & Get Contractor Info ---
        // We do this in ONE query to avoid multiple database calls.
        const { data: contractData, error: contractError } = await supabase
            .from('contracts')
            .update({ status: 'penalized' }) // Status updated to 'rejected'
            .eq('id', id)
            .select(`
                *, 
                bids (
                    contractor_id,            
                    users ( email )
                )
            `)
            .single();

        if (contractError) {
            if (contractError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Contract not found.' });
            }
            throw contractError;
        }

        // Extract contractor details safely
        const contractorId = contractData.bids?.contractor_id;
        const contractorEmail = contractData.bids?.users?.email;

        if (!contractorId) {
            return res.status(404).json({ error: 'Could not find the contractor for this contract.' });
        }

        const { data: imageData, error: imageError } = await supabase
            .from('images')
            .update({ type: 'before_repair' })
            .eq('pothole_id', potholeId) // Use the correct ID column here (e.g., 'id' or 'pothole_id')
            .select()
            .maybeSingle(); // <--- This returns null (no error) if 0 rows are found

        if (imageError) {
            console.error("Error updating image:", imageError);
        } else if (!imageData) {
            console.log("No image found to update; continuing...");
        }

        // Send Email (Fire-and-forget: don't await if you don't want to block the response)
        if (contractorEmail) {
            // Ensure this function exists in your codebase
            sendRepairRejectedEmail(contractorEmail, "");
        } else {
            console.warn("Could not send email: Contractor email not found.");
        }


        // --- STEP 2: Handle Penalties ---

        // 2a. Fetch current penalty count
        const { data: contractorDetails } = await supabase
            .from('contractor_details')
            .select('no_of_penalty')
            .eq('user_id', contractorId)
            .single();

        const currentPenalties = contractorDetails?.no_of_penalty || 0;
        const newPenaltyCount = currentPenalties + 1;

        // 2b. Increment penalty count
        const { error: updateError } = await supabase
            .from('contractor_details')
            .update({ no_of_penalty: newPenaltyCount })
            .eq('user_id', contractorId);

        if (updateError) console.error('Failed to update penalty count:', updateError);


        // --- STEP 3: Check for Blacklisting ---
        let finalMessage = 'Contract has been penalized.';
        let isBlacklisted = false;

        // If penalties exceed limit, blacklist the user
        if (newPenaltyCount >= 10) {
            const { error: blacklistError } = await supabase
                .from('users')
                .update({ verify: 'blacklisted' })
                .eq('id', contractorId);

            if (!blacklistError) {
                isBlacklisted = true;
                finalMessage = 'Contractor has been penalized and BLACKLISTED.';
            }
            // --- STEP 4: Fetch All Bids for Contractor ---
            // This is the variable that was missing/scoped incorrectly in your original code.
            // We fetch it here so it is available for the final response.
            const { data: bidsData, error: bidsError } = await supabase
                .from('bids')
                .select(`
                    *,
                    contracts ( status, start_date, expected_end_date )
                `)
                .eq('contractor_id', contractorId);

            if (bidsError) console.error("Error fetching bids:", bidsError);
            console.log(bidsData, "biddata");
            console.log(bidsData[0].contracts, "contracts");
            const potholeIdsToDelete = getIdsToDelete(bidsData);

            console.log("List of Pothole IDs to delete:", potholeIdsToDelete);
            if (potholeIdsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from('bids')
                    .delete()
                    .in('pothole_id', potholeIdsToDelete); // Pass the WHOLE array here

                if (deleteError) {
                    console.error('Error deleting bids:', deleteError.message);
                } else {
                    console.log('Bids deleted successfully.');
                }
            }
            if (potholeIdsToDelete.length > 0) {
                const { data, error } = await supabase
                    .from('potholes')
                    .update({ status: 'reported' })      // 1. Set the new status
                    .in('id', potholeIdsToDelete)        // 2. Filter by your list of IDs
                    .eq('status', 'under_review');       // 3. (Optional) Strict check: only update if currently 'under_review'

                if (error) {
                    console.error('Error updating potholes:', error.message);
                } else {
                    console.log('Potholes reset to reported successfully.');
                }
            }
        }




        // --- STEP 5: Send ONE Final Response ---
        // This is the only place we send a response, preventing "Headers already sent" errors.
        var bidsData = [];
        return res.status(200).json({
            message: finalMessage,
            contract: contractData,
            contractorBids: bidsData,
            contractorEmail: contractorEmail,
            blacklisted: isBlacklisted
        });

    } catch (error) {
        console.error('Error rejecting pothole repair:', error.message);

        // Safety check: Don't try to send error if success response was already sent
        if (!res.headersSent) {
            res.status(500).json({ error: 'An unexpected error occurred on the server.' });
        }
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
            .update({
                image_url: publicUrl,
                type: 'before_repair'
            })
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
        const { data: imageData, error: imageError } = await supabase
            .from('images')
            .update({ type: 'fix_proof' })
            .eq('pothole_id', id) // Use the correct ID column here (e.g., 'id' or 'pothole_id')
            .select()
            .maybeSingle(); // <--- This returns null (no error) if 0 rows are found

        if (imageError) {
            console.error("Error updating image:", imageError);
        } else if (!imageData) {
            console.log("No image found to update; continuing...");
        }

        // Updated success message
        res.status(200).json({ message: 'Reopened claim discarded and pothole status set to fixed.', data });

    } catch (error) {
        console.error('Error in discardReopen:', error); // Updated log message
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const penalizeReopen = async (req, res) => {
    const { id } = req.params; // This is the CONTRACT ID

    console.log("Penalizing contract ID:", id);

    // 1. Validation: Check for valid UUID and ensure it's not the string "undefined"
    if (!id || id === 'undefined' || id === 'null') {
        return res.status(400).json({ error: 'Valid Contract ID is required.' });
    }

    try {
        // --- Step 1: Update Contract Status ---
        const { data, error } = await supabase
            .from('contracts')
            .update({ status: 'penalized' })
            .eq('id', id)
            .select(`
                *, 
                bids (
                    contractor_id,
                    pothole_id,            
                    users ( email )
                )
            `)
            .single();

        if (error || !data) {
            if (error?.code === 'PGRST116' || !data) {
                return res.status(404).json({ error: 'Contract not found.' });
            }
            throw error;
        }

        const contractData = data;
        
        // Safe navigation to extract data
        const contractorId = data.bids?.contractor_id;
        const potholeID = data.bids?.pothole_id; // Get the Pothole ID
        const contractorEmail = data.bids?.users?.email;

        // --- Step 2: Send Reopen Notification Email ---
        if (contractorEmail) {
            // Note: potholeDescription is empty in your original code, you might want to fetch it if needed
            sendPotholeReappearedEmail(contractorEmail, ""); 
        } else {
            console.warn("Skipping email: No contractor email found.");
        }

        if (!contractorId) {
            return res.status(404).json({ error: 'Contractor not found for this contract.' });
        }

        // --- Step 3: Increment Penalty Count ---
        
        // 3a. Read current count
        const { data: contractorDetails } = await supabase
            .from('contractor_details')
            .select('no_of_penalty')
            .eq('user_id', contractorId)
            .single();

        const currentPenalties = contractorDetails?.no_of_penalty || 0;
        const newPenaltyCount = currentPenalties + 1;

        // 3b. Update count
        await supabase
            .from('contractor_details')
            .update({ no_of_penalty: newPenaltyCount })
            .eq('user_id', contractorId);

        // --- Step 4: Handle Blacklisting (Threshold >= 10) ---
        if (newPenaltyCount >= 10) {
            console.log(`Contractor ${contractorId} has reached penalty limit. Blacklisting...`);

            // 4a. Mark user as blacklisted
            await supabase
                .from('users')
                .update({ verify: 'blacklisted' })
                .eq('id', contractorId);

            // 4b. Fetch all active bids for this contractor
            const { data: bidsData } = await supabase
                .from('bids')
                .select('pothole_id')
                .eq('contractor_id', contractorId);

            // 4c. Logic to clean up bids (assuming getIdsToDelete exists or we map them here)
            const potholeIdsToDelete = bidsData ? bidsData.map(b => b.pothole_id) : [];

            if (potholeIdsToDelete.length > 0) {
                // Delete bids
                await supabase.from('bids').delete().in('pothole_id', potholeIdsToDelete);
                
                // Reset associated potholes to 'reported'
                await supabase
                    .from('potholes')
                    .update({ status: 'reported' })
                    .in('id', potholeIdsToDelete)
                    .eq('status', 'under_review');
            }

            // 4d. Ensure the CURRENT pothole is reset
            if (potholeID) {
                await supabase
                    .from('potholes')
                    .update({ status: 'reported' })
                    .eq('id', potholeID);
                
                // Reset the image type using POTHOLE ID (Fixed Bug: was using Contract ID 'id')
                await supabase
                    .from('images')
                    .update({ type: 'fix_proof' }) // Or whatever type implies it needs fixing again
                    .eq('pothole_id', potholeID); 
            }

            // 4e. Send Blacklist Email
            if (contractorEmail) sendBlacklistEmail(contractorEmail, "");

            return res.status(200).json({
                message: 'Contract penalized and Contractor has been Blacklisted.',
                contract: contractData,
            });

        } else {
            // --- Step 5: Handle Normal Penalty (Threshold < 10) ---
            
            // CRITICAL FIX: You were missing the response here in your original code
            return res.status(200).json({
                message: 'Contract has been penalized.',
                contract: contractData,
                penalty_count: newPenaltyCount
            });
        }

    } catch (error) {
        console.error('Error penalizing contract:', error.message);
        return res.status(500).json({ error: 'An unexpected error occurred on the server.' });
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

        // Detect severity and type using Gemini
        console.log(`[Backend] Detecting severity and type from uploaded image...`);
        const { severity: detectedSeverity, type: detectedType } = await detectPotholeSeverityAndType(imageBase64, imageFile.mimetype);

        res.status(200).json({
            success: true,
            severity: detectedSeverity,
            type: detectedType,
            message: 'Severity and type detected successfully'
        });

    } catch (error) {
        console.error('Error detecting severity from image:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to detect severity and type',
            severity: 'Medium', // Fallback severity
            type: 'Standard road damage' // Fallback type
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

// --- Dashboard: status by severity ---
export const getStatusBySeverity = async (req, res) => {
    try {
        const { data, error } = await supabase.from('potholes').select('status, severity');
        if (error) throw error;
        const counts = {};
        for (const row of data || []) {
            const sev = row.severity || 'Unknown';
            const st = row.status || 'unknown';
            if (!counts[sev]) counts[sev] = {};
            counts[sev][st] = (counts[sev][st] || 0) + 1;
        }
        const series = [];
        Object.entries(counts).forEach(([severity, statusMap]) => {
            Object.entries(statusMap).forEach(([status, count]) => {
                series.push({ severity, status, count });
            });
        });
        return res.status(200).json({ counts, series });
    } catch (err) {
        console.error('Error aggregating status by severity:', err);
        return res.status(500).json({ error: 'Failed to get status by severity' });
    }
};

// --- Dashboard: reports vs resolutions (completed contracts) ---
export const getReportsVsResolutions = async (req, res) => {
    try {
        const now = new Date();
        const { start, end } = req.query;
        const endDate = end ? new Date(end) : now;
        const startDate = start ? new Date(start) : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

        const [{ data: potholes, error: potholesErr }, { data: contracts, error: contractsErr }] = await Promise.all([
            supabase.from('potholes').select('created_at'),
            supabase.from('contracts').select('actual_end_date, status').eq('status', 'completed')
        ]);
        if (potholesErr) throw potholesErr;
        if (contractsErr) throw contractsErr;

        const dayKey = (d) => {
            const dt = new Date(d);
            dt.setHours(0, 0, 0, 0);
            return dt.toISOString().slice(0, 10);
        };

        const byDay = new Map();
        const cursor = new Date(startDate);
        cursor.setHours(0, 0, 0, 0);
        const endCursor = new Date(endDate);
        endCursor.setHours(0, 0, 0, 0);
        while (cursor <= endCursor) {
            byDay.set(dayKey(cursor), { date: dayKey(cursor), reported: 0, resolved: 0 });
            cursor.setDate(cursor.getDate() + 1);
        }

        for (const p of potholes || []) {
            if (!p.created_at) continue;
            const k = dayKey(p.created_at);
            if (byDay.has(k)) byDay.get(k).reported += 1;
        }
        for (const c of contracts || []) {
            if (!c.actual_end_date) continue;
            const k = dayKey(c.actual_end_date);
            if (byDay.has(k)) byDay.get(k).resolved += 1;
        }

        const series = Array.from(byDay.values());
        return res.status(200).json({ start: dayKey(startDate), end: dayKey(endDate), series });
    } catch (err) {
        console.error('Error aggregating reports vs resolutions:', err);
        return res.status(500).json({ error: 'Failed to get reports vs resolutions' });
    }
};

// --- Dashboard: verification funnel ---
export const getVerificationFunnel = async (req, res) => {
    try {
        const [{ data: potholes, error: potholesErr }, { data: completedContracts, error: contractsErr }] = await Promise.all([
            supabase.from('potholes').select('id, verify, status'),
            supabase.from('contracts').select('id, status').eq('status', 'completed')
        ]);
        if (potholesErr) throw potholesErr;
        if (contractsErr) throw contractsErr;

        const reported = (potholes || []).length;
        const verified = (potholes || []).filter(p => p.verify === true).length;
        const assignedUnderReview = (potholes || []).filter(p => p.status === 'under_review').length;
        const completed = (completedContracts || []).length;

        return res.status(200).json({
            steps: [
                { key: 'reported', label: 'Reported', count: reported },
                { key: 'verified', label: 'Verified', count: verified },
                { key: 'under_review', label: 'Assigned / Under Review', count: assignedUnderReview },
                { key: 'completed', label: 'Completed', count: completed },
            ]
        });
    } catch (err) {
        console.error('Error aggregating verification funnel:', err);
        return res.status(500).json({ error: 'Failed to get verification funnel' });
    }
};
// --- Dashboard KPIs: bids submitted, accepted, acceptance rate, average resolution time ---
export const getDashboardKpis = async (req, res) => {
    try {
        const [bidsRes, contractsRes] = await Promise.all([
            supabase.from('bids').select('status'),
            supabase.from('contracts').select('start_date, actual_end_date, status')
        ]);

        if (bidsRes.error) throw bidsRes.error;
        if (contractsRes.error) throw contractsRes.error;

        const bids = bidsRes.data || [];
        const bids_submitted = bids.length;
        const bids_accepted = bids.filter(b => b.status === 'accepted').length;
        const acceptance_rate_pct = bids_submitted > 0 ? +(bids_accepted / bids_submitted * 100).toFixed(1) : 0;

        const completed = (contractsRes.data || []).filter(c => c.status === 'completed' && c.start_date && c.actual_end_date);
        const durationsMs = completed.map(c => new Date(c.actual_end_date).getTime() - new Date(c.start_date).getTime()).filter(ms => ms > 0);
        const avgMs = durationsMs.length ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length : 0;
        const average_resolution_days = +(avgMs / (1000 * 60 * 60 * 24)).toFixed(1);

        return res.status(200).json({ bids_submitted, bids_accepted, acceptance_rate_pct, average_resolution_days });
    } catch (err) {
        console.error('Error computing dashboard KPIs:', err);
        return res.status(500).json({ error: 'Failed to compute dashboard KPIs' });
    }
};