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

    try {
        // First check if bid exists for this pothole
        const { data: existingBid, error: fetchError } = await supabase
            .from('bids')
            .select('*')
            .eq('pothole_id', pothole_id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
            throw fetchError;
        }

        let result;

        if (existingBid) {
            // Update existing bid
            const { data, error } = await supabase
                .from('bids')
                .update({
                    contractor_id,
                    amount: parseFloat(amount),
                    description,
                })
                .eq('pothole_id', pothole_id)
                .select()
                .single();

            if (error) throw error;
            result = { data, message: 'Bid updated successfully' };
        } else {
            // Insert new bid
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
        // NOTE: For production, these three operations should be combined into a single 
        // database transaction using a Supabase RPC function to ensure data integrity.
        // Here, we execute them sequentially.

        // --- Step 1: Update the Pothole ---
        // Change the pothole's status to 'under_review'.
        const { data, error: potholeUpdateError } = await supabase
            .from('potholes')
            .update({ status: 'under_review' })
            .eq('id', potholeId)
            .select(`
                    *,
                    users (id,email)
            `);

        if (potholeUpdateError) {
            throw potholeUpdateError;
        }
        if (data[0]?.users?.email) {

            // Log the email for debugging
            console.log("email", data[0].users.email);


            await sendContractAssignEmail(data[0].users.email, data[0].description);

        } else {
            console.warn("Could not send email: User email not found in the data.");
        }
        // --- Step 2: Update the Bid ---
        // Change the status of the accepted bid to 'accepted'.
        const { error: bidUpdateError } = await supabase
            .from('bids')
            .update({ status: 'accepted' })
            .eq('id', bidId);

        if (bidUpdateError) {
            throw bidUpdateError;
        }

        // --- Step 3: Create the Contract ---
        // Insert a new row into the 'contracts' table.
        const { error: contractInsertError } = await supabase
            .from('contracts')
            .insert({
                bid_id: bidId,
                approved_by: approverId,
                status: 'ongoing' // Set the new contract's status
            });

        if (contractInsertError) {
            throw contractInsertError;
        }

        // 4. Send a success response
        res.status(200).json({ message: 'Bid accepted and contract created successfully.' });

    } catch (error) {
        // 5. Handle any errors that occur during the process
        console.error('Error accepting bid and creating contract:', error);
        res.status(500).json({ error: 'Internal server error while processing the bid.' });
    }
};