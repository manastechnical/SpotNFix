import supabase from '../supabaseClient.js';

export const potholeFixed = async (req, res) => {
    // 1. Get IDs from the request
    const { bidId } = req.params;
    const { potholeId } = req.body; // Get potholeId from the request body

    // 2. Validate inputs
    if (!bidId || !potholeId) {
        return res.status(400).json({ error: 'Bid ID and Pothole ID are required.' });
    }

    try {
        // 3. Update the contract status to 'completed'
        const { data: contractData, error: contractError } = await supabase
            .from('contracts')
            .update({
                status: 'completed',
                actual_end_date: new Date().toISOString(),
            })
            .eq('bid_id', bidId)
            .select()
            .single(); // Use single() as we expect one record per bid

        if (contractError) {
            if (contractError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Contract not found for the given bid ID.' });
            }
            throw contractError;
        }

        // 4. Update the pothole status to 'under_review'
        const { data: potholeData, error: potholeError } = await supabase
            .from('potholes')
            .update({ status: 'under_review' })
            .eq('id', potholeId)
            .select()
            .single();

        if (potholeError) {
            // This is a critical error. In a real app, you might roll back the contract update.
            return res.status(500).json({ error: 'Contract updated, but failed to update pothole status.' });
        }
        
        // 5. Send a success response with all updated data
        return res.status(200).json({
            message: 'Work marked as complete and is now under review.',
            contract: contractData,
            pothole: potholeData
        });

    } catch (error) {
        // 6. Handle any other unexpected errors
        console.error("Error in potholeFixed controller:", error.message);
        return res.status(500).json({ 
            error: 'An internal server error occurred.',
            details: error.message 
        });
    }
};