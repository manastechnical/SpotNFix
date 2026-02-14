import supabase from '../supabaseClient.js';
import { sendContractAssignEmail } from '../utils/sendContractAssignEmail.js';

export const submitBid = async (req, res) => {
    const { pothole_id, contractor_id, amount, description } = req.body;

    // Validate required fields
    if (!pothole_id || !contractor_id || !amount || !description) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['pothole_id', 'contractor_id', 'amount', 'description']
        });
    }

    // 1. Check if user is blacklisted
    try {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", contractor_id)
            .single();

        if (error) throw error;
        
        if (data.verify === "blacklisted") {
            console.error('Error handling bid: User is blacklisted');
            return res.status(500).json({ error: 'User is blacklisted' });
        }

    } catch (error) {
        console.error("Check failed:", error.message);
        return res.status(500).json({ error: "Server validation failed" });
    }

    try {
        // 2. Check if THIS contractor already has a bid for THIS pothole
        const { data: existingBid, error: fetchError } = await supabase
            .from('bids')
            .select('*')
            .eq('pothole_id', pothole_id)
            .eq('contractor_id', contractor_id) // <--- CRITICAL: Filter by contractor too
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
            throw fetchError;
        }

        let result;

        if (existingBid) {
            // --- SCENARIO A: UPDATE EXISTING BID ---
            console.log(`Updating bid for bidID: ${existingBid.id}`);
            
            const { data, error } = await supabase
                .from('bids')
                .update({
                    amount: parseFloat(amount),
                    description: description,
                    bid_at: new Date() // Update timestamp
                })
                .eq('id', existingBid.id)
                .select()
                .single();

            if (error) throw error;
            result = { data, message: 'Bid updated successfully' };
        } else {
            // --- SCENARIO B: CREATE NEW BID ---
            console.log(`Creating new bid for potholeID: ${pothole_id}`);
            
            const { data, error } = await supabase
                .from('bids')
                .insert([{
                    pothole_id,
                    contractor_id,
                    amount: parseFloat(amount),
                    description,
                    status: 'pending'
                }])
                .select()
                .single();

            if (error) throw error;
            result = { data, message: 'Bid submitted successfully' };
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('Error handling bid:', error);
        return res.status(500).json({
            error: 'Failed to process bid'
        });
    }
};

export const acceptBid = async (req, res) => {
    // 1. Get IDs from the request
    const { potholeId } = req.params;
    const { bidId, approverId } = req.body;

    // 2. Validate all required inputs
    if (!potholeId || !bidId || !approverId) {
        return res.status(400).json({ error: 'Pothole ID, Bid ID, and Approver ID are required.' });
    }

    try {
        // --- Step 1: Update the Pothole ---
        const { data, error: potholeUpdateError } = await supabase
            .from('potholes')
            .update({ status: 'under_review' })
            .eq('id', potholeId)
            .select(`
                *,
                bids (
                    *,
                    users ( name, email )
                )
            `);

        if (potholeUpdateError) throw potholeUpdateError;

        // Send Email to the winner
        // We find the specific bid that was passed in the body, not just the first one
        const selectedBid = data[0]?.bids?.find(b => b.id === bidId);
        
        if (selectedBid?.users?.email) {
            console.log("Sending email to:", selectedBid.users.email);
            sendContractAssignEmail(selectedBid.users.email, data[0].description);
        } else {
            console.warn("Could not send email: User email not found.");
        }

        // --- Step 2: Update the Winning Bid to 'accepted' ---
        const { error: bidUpdateError } = await supabase
            .from('bids')
            .update({ status: 'accepted' })
            .eq('id', bidId);

        if (bidUpdateError) throw bidUpdateError;

        // --- Step 3: Reject all OTHER bids for this pothole ---
        // This ensures other contractors know they didn't win
        const { error: rejectOthersError } = await supabase
            .from('bids')
            .update({ status: 'rejected' })
            .eq('pothole_id', potholeId)
            .neq('id', bidId); // Don't reject the one we just accepted

        if (rejectOthersError) {
            console.error("Warning: Failed to reject other bids", rejectOthersError);
            // We don't throw here to avoid rolling back the successful acceptance, 
            // but it's good to log it.
        }

        // --- Step 4: Create the Contract ---
        const { error: contractInsertError } = await supabase
            .from('contracts')
            .insert({
                bid_id: bidId,
                approved_by: approverId,
                status: 'ongoing'
            });

        if (contractInsertError) throw contractInsertError;

        // 5. Send a success response
        res.status(200).json({ message: 'Bid accepted and contract created successfully.' });

    } catch (error) {
        console.error('Error accepting bid:', error);
        res.status(500).json({ error: 'Internal server error while processing the bid.' });
    }
};