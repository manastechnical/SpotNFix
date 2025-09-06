import supabase from '../supabaseClient.js';

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