import supabase from '../supabaseClient.js';
import { sendVerificationEmail } from '../utils/sendVerificationEmail.js';
import jwt from 'jsonwebtoken';

// Hardcoded admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

export const loginAdmin = (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Credentials are correct, create a JWT
        const token = jwt.sign(
            { role: 'superadmin' }, 
            process.env.JWT_SECRET, // Make sure to add a JWT_SECRET to your .env file
            { expiresIn: '1h' }
        );

        res.status(200).json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
};

export const getPendingVerifications = async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select(`
                id, name, email, phone, role, created_at,
                contractor_details (*),
                government_official_details (*)
            `)
            .in('role', ['contractor', 'government'])
            .eq('status', 'pending');

        if (error) throw error;
        
        // Generate public URLs for documents for EACH role
        const usersWithDocUrls = users.map(user => {
            if (user.role === 'contractor' && user.contractor_details) {
                const { pan_card_url, aadhaar_card_url, gst_certificate_url } = user.contractor_details;
                if (pan_card_url) user.contractor_details.pan_card_public_url = supabase.storage.from('documents').getPublicUrl(pan_card_url).data.publicUrl;
                if (aadhaar_card_url) user.contractor_details.aadhaar_card_public_url = supabase.storage.from('documents').getPublicUrl(aadhaar_card_url).data.publicUrl;
                if (gst_certificate_url) user.contractor_details.gst_certificate_public_url = supabase.storage.from('documents').getPublicUrl(gst_certificate_url).data.publicUrl;
            } 
            
            else if (user.role === 'government' && user.government_official_details) {
                const { government_id_url, proof_of_employment_url } = user.government_official_details;
                if (government_id_url) user.government_official_details.government_id_public_url = supabase.storage.from('documents').getPublicUrl(government_id_url).data.publicUrl;
                if (proof_of_employment_url) user.government_official_details.proof_of_employment_public_url = supabase.storage.from('documents').getPublicUrl(proof_of_employment_url).data.publicUrl;
            }
            return user;
        });

        res.status(200).json({ success: true, data: usersWithDocUrls });

    } catch (error) {
        console.error("Error fetching pending verifications:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending verifications.' });
    }
};

export const updateUserVerification = async (req, res) => {
    const { userId, status } = req.body; // status should be 'approved' or 'rejected'

    if (!userId || !status) {
        return res.status(400).json({ success: false, message: 'User ID and status are required.' });
    }

    try {
        const { data: user, error: updateError } = await supabase
            .from('users')
            .update({ 
                status,
            })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) throw updateError;
        
        // Send notification email
        await sendVerificationEmail(user.email, status);

        res.status(200).json({ success: true, message: `User status updated to ${status}.` });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user verification.' });
    }
};