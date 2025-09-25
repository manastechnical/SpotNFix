import supabase from '../supabaseClient.js';

export const potholeFixed = async (req, res) => {
    // 1. Get the contract ID from the request parameters
    const { bidId } = req.params;
    console.log("Received request to complete work for contract ID:", bidId);
    // A simple validation to ensure the ID is present
    if (!bidId) {
        return res.status(400).json({ error: 'Contract ID is required.' });
    }

    try {
        // 2. Update the specific contract in the Supabase 'contracts' table
        const { data, error } = await supabase
            .from('contracts')
            .update({
                status: 'completed',                      // Set status to 'completed'
                actual_end_date: new Date().toISOString(), // Set the end date to now
            })
            .eq('bid_id', bidId) // Find the row where the 'id' matches bidId
            .select()             // Return the updated row data

        // 3. Handle any potential errors from the database
        if (error) {
            console.error('Supabase error:', error.message);
            throw error; // This will be caught by the outer catch block
        }
        
        // 4. Check if a row was actually updated (if not, the ID was not found)
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Contract not found.' });
        }

        // 5. If successful, send a success response with the updated data
        console.log(`Contract ${bidId} was successfully marked as completed.`);
        return res.status(200).json({
            message: 'Work successfully marked as complete.',
            data: data[0] // The updated contract record
        });

    } catch (error) {
        // 6. Handle any other unexpected errors
        return res.status(500).json({ 
            error: 'An internal server error occurred.',
            details: error.message 
        });
    }
};