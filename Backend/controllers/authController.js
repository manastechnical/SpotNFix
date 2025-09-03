import supabase from '../supabaseClient.js';
import { sendOtpEmail } from '../utils/sendOtpEmail.js';
import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

let GLOBAL_OTP = '0';
export const registerUser = async (req, res) => {
    try {
        const { name, email_id, password, mobile, user_type } = req.body;

        if (!name || !email_id || !password || !mobile || !user_type) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email_id)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        // Handle existing user
        if (existingUser) {
            if (existingUser.verify === 'unverified') {
                await supabase.from('users').delete().eq('id', existingUser.id);
            } else {
                return res.status(409).json({ message: 'User already exists' });
            }
        }


        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([
                {
                    name,
                    email: email_id,
                    phone: mobile,  // <-- Ensure this matches Supabase column name
                    role: user_type,
                    password: password, // Ensure password is hashed before storing in production
                    verify: 'unverified',
                },
            ])
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
        }
        GLOBAL_OTP = ""+Math.floor(100000 + Math.random() * 900000); // Generate a 6-digit OTP
        await sendOtpEmail(email_id, GLOBAL_OTP);

        return res.status(201).json({
            success: true,
            message: 'User registered',
            data: {
                u_id: newUser.id,
                name: newUser.name,
                email: newUser.email,
            },
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const validateOtp = async (req, res) => {
    const { userId, otp } = req.body;
    console.log("💡 validateOtp received:", { userId, otp });
    if (!userId || !otp) {
        return res.status(400).json({ message: 'userId and OTP are required' });
    }

    try {
        // Fetch user
        const { data: user, error } = await supabase
            .from('users')
            .select('id, verify') // include otp_expiry if you're using it
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already verified
        if (user.verify === 'verified') {
            return res.status(409).json({ message: 'User already verified' });
        }

        // OPTIONAL: Check if OTP is expired (if you're storing expiry)
        // const now = new Date();
        // if (user.otp_expiry && new Date(user.otp_expiry) < now) {
        //   return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
        // }

        // Validate OTP
        console.log("💡 GLOBAL_OTP:", GLOBAL_OTP, "Received OTP:", otp);
        if (GLOBAL_OTP != otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Update verify status and clear OTP
        const { error: updateError } = await supabase
            .from('users')
            .update({ verify: 'verified' })
            .eq('id', userId);

        if (updateError) {
            return res.status(500).json({ message: 'Failed to verify user' });
        }

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully. Account is now verified.',
        });

    } catch (err) {
        console.error('OTP Validation Error:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const resendOtp = async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    try {
        // Fetch user from Supabase
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.verify === 'verified') {
            return res.status(400).json({ success: false, message: 'User already verified' });
        }
        // Send OTP email
        GLOBAL_OTP = ""+Math.floor(100000 + Math.random() * 900000); // Generate a new 6-digit OTP
        await sendOtpEmail(user.email, GLOBAL_OTP);

        return res.status(200).json({ success: true, message: 'OTP resent successfully' });
    } catch (err) {
        console.error('Resend OTP error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const login = async (req, res) => {
    try {
        // TODO: Check credentials in database here
        const { email_id, role, password } = req.body;
        console.log("Login request received:", req.body);
        // Fetch user by email
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email_id)
            .eq('role', role) // Adjust role as needed
            .eq('password', password) // Ensure password is hashed in production
            .single();

        if (error || !userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if user is verified
        if (userData.verify !== 'verified') {
            return res.status(401).json({ success: false, message: 'Email not verified' });
        }
        // If login successful
        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                u_id: userData.id, // or whatever actual ID
                name: userData.name,
                email: userData.email,
                role: userData.role,
                isNew: false,
            },
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Login failed",
        });
    }
};

export const signInWithGoogle = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ success: false, message: "Missing Google credential" });
        }

        // ✅ Verify token with Google
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;

        // ✅ Check if user already exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (fetchError && fetchError.code !== "PGRST116") {
            // PGRST116 means no rows found
            throw fetchError;
        }

        if (existingUser) {
            return res.json({ success: true, data: { u_id: existingUser.id, name: existingUser.name, email: existingUser.email, role: existingUser.role, isNew: false }, message: "User found" });
        }

        // ✅ Insert new user
        const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert([{ email, name: name, phone: '', role: 'citizen', verify: 'verified', password: '123456' }])
            .select()
            .single();

        if (insertError) throw insertError;

        res.json({ success: true, data: { u_id: newUser.id, name: newUser.name, email: newUser.email, role:newUser.role , isNew: false }, message: "New user created" });

    } catch (error) {
        console.error("Google Sign-In Error:", error);
        res.status(500).json({
            success: false,
            message: "Google Sign-In verification failed",
        });
    }
};