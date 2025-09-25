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
        if (error) {
            throw error;
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('RPC failed for nearby potholes, attempting fallback:', error);

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
                .select('id, latitude, longitude, description, severity, status')
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
            .select()
            .single(); // .single() to return the updated record

        if (error) {
            if (error.code === 'PGRST116') { // Error code for "No rows found"
                return res.status(404).json({ error: 'Pothole not found.' });
            }
            throw error;
        }

        res.status(200).json({ message: 'Pothole verified successfully!', data });

    } catch (error) {
        console.error('Error verifying pothole:', error);
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
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Pothole not found.' });
            }
            throw error;
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
            .select()
            .single();

        // If the RPC call returns an error (e.g., pothole not found)
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
    // In a real app, you would have authentication middleware here.
    
    const { id } = req.params; // Get the pothole ID from the URL
    console.log("Rejecting repair for pothole ID:", id);
    if (!id) {
        return res.status(400).json({ error: 'Pothole ID is required.' });
    }

    try {
        // Call the 'reject_repair' PostgreSQL function via RPC.
        // This single call handles updates to both the potholes and contracts tables.
        const { data, error } = await supabase
            .from('contracts')
            .update({ status: 'ongoing' })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            // "PGRST116" is the code for a function that returns 0 rows, meaning the pothole wasn't found.
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Pothole not found or no completed contract to reject.' });
            }
            throw error; // Let the catch block handle other errors.
        }

        // Send the updated pothole data back as a success response.
        res.status(200).json({
            message: 'Pothole repair rejected. Status has been reset.',
            pothole: data,
        });

    } catch (error) {
        console.error('Error rejecting pothole repair:', error.message);
        res.status(500).json({ error: 'An unexpected error occurred on the server.' });
    }
};