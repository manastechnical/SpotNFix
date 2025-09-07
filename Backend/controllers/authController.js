import supabase from '../supabaseClient.js';
import { sendOtpEmail } from '../utils/sendOtpEmail.js';
import { OAuth2Client } from 'google-auth-library';
import { validateRegistrationData } from '../middleware/formatValidation.js';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);
const client = new OAuth2Client(process.env.VITE_PUBLIC_GOOGLE_CLIENT);
const upload = multer({ dest: 'uploads/' });

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

         // 2. NEW FIX: Check if contractors or officials have been approved by an admin
        if (userData.role === 'contractor' || userData.role === 'government') {
            if (userData.status !== 'approved') {
                let message = 'Your account is still pending admin approval.';
                if (userData.status === 'rejected') {
                    message = 'Your registration has been rejected by the admin.';
                }
                return res.status(403).json({ success: false, message });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                u_id: userData.id,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                isNew: false, // This might need review based on your app logic
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

// ... (Your other controller functions like login, registerContractor, etc. remain the same)


// --- UPDATED GOOGLE SIGN-IN FUNCTION ---

export const signInWithGoogle = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ success: false, message: "Missing Google credential" });
        }

        // Verify token with Google
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;

        // Check if user already exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (fetchError && fetchError.code !== "PGRST116") {
            // PGRST116 means no rows found, which is a valid case. Any other error should be thrown.
            throw fetchError;
        }

        if (existingUser) {
            // FIX: Check if existing contractors or officials have been approved by an admin
            if (existingUser.role === 'contractor' || existingUser.role === 'government') {
                if (existingUser.status !== 'approved') {
                    let message = 'Your account is pending admin approval.';
                    if (existingUser.status === 'rejected') {
                        message = 'Your registration has been rejected by the admin.';
                    }
                    return res.status(403).json({ success: false, message });
                }
            }

            // If the user is a citizen OR an approved contractor/official, log them in
            return res.json({ 
                success: true, 
                data: { 
                    u_id: existingUser.id, 
                    name: existingUser.name, 
                    email: existingUser.email, 
                    role: existingUser.role, 
                    isNew: false 
                }, 
                message: "User found" 
            });
        }

        // If the user does not exist, create a new 'citizen' account.
        // This flow assumes that only citizens can be created instantly via Google Sign-In.
        const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert([{ 
                email, 
                name: name, 
                phone: '', 
                role: 'citizen', 
                verify: 'verified', 
                status: 'approved', // Citizens are auto-approved
                password: '123456'  // Placeholder password
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        res.json({ 
            success: true, 
            data: { 
                u_id: newUser.id, 
                name: newUser.name, 
                email: newUser.email, 
                role: newUser.role, 
                isNew: false 
            }, 
            message: "New user created" 
        });

    } catch (error) {
        console.error("Google Sign-In Error:", error);
        res.status(500).json({
            success: false,
            message: "Google Sign-In verification failed",
        });
    }
};

export const registerContractor = [
    upload.fields([
        { name: 'panCard', maxCount: 1 },
        { name: 'aadhaarCard', maxCount: 1 },
        { name: 'gstCertificate', maxCount: 1 },
    ]),
    validateRegistrationData,
    async (req, res) => {
        const { name, email_id, password, mobile, business_name, business_address, gst_number, pan_number } = req.body;

        try {
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('email')
                .eq('email', email_id)
                .single();

            if (existingUser) {
                return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
            }
            
            const panCard = req.files.panCard[0];
        const aadhaarCard = req.files.aadhaarCard[0];
        const gstCertificate = req.files.gstCertificate[0];
            // 1. Create the user in the 'users' table
            const { data: newUser, error: userError } = await supabase.from('users').insert([{
                name,
                email: email_id,
                phone: mobile,
                role: 'contractor',
                password, // Remember to hash passwords in production
                verify: 'unverified',
                status: 'pending'
            }]).select().single();

            if (userError) throw userError;

            const [panBuffer, aadhaarBuffer, gstBuffer] = await Promise.all([
                readFileAsync(panCard.path),
                readFileAsync(aadhaarCard.path),
                readFileAsync(gstCertificate.path)
            ]);

            // 2. Upload files to Supabase Storage
            const panCardPath = `public/contractor-documents/${newUser.id}/pan_card.pdf`;
            const aadhaarCardPath = `public/contractor-documents/${newUser.id}/aadhaar_card.pdf`;
            const gstCertificatePath = `public/contractor-documents/${newUser.id}/gst_certificate.pdf`;

             const [panUpload, aadhaarUpload, gstUpload] = await Promise.all([
                supabase.storage.from('documents').upload(panCardPath, panBuffer, { contentType: 'application/pdf' }),
                supabase.storage.from('documents').upload(aadhaarCardPath, aadhaarBuffer, { contentType: 'application/pdf' }),
                supabase.storage.from('documents').upload(gstCertificatePath, gstBuffer, { contentType: 'application/pdf' })
            ]);

            if (panUpload.error || aadhaarUpload.error || gstUpload.error) {
                throw new Error('File upload failed');
            }

            // 3. Insert into 'contractor_details' table
            const { error: detailsError } = await supabase.from('contractor_details').insert([{
                user_id: newUser.id,
                business_name,
                business_address,
                gst_number,
                pan_number,
                pan_card_url: panCardPath,
                aadhaar_card_url: aadhaarCardPath,
                gst_certificate_url: gstCertificatePath
            }]);

            if (detailsError) throw detailsError;

            // 4. Clean up uploaded files from the server
            await Promise.all([
                unlinkAsync(panCard.path),
                unlinkAsync(aadhaarCard.path),
                unlinkAsync(gstCertificate.path)
            ]);
            
            // 5. Send OTP for email verification
            GLOBAL_OTP = ""+Math.floor(100000 + Math.random() * 900000);
            await sendOtpEmail(email_id, GLOBAL_OTP);


            res.status(201).json({ 
                success: true, 
                message: 'Contractor registration successful.',
                data: {
                    u_id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                }
            });

        } catch (error) {
            console.error('Contractor registration error:', error);
            res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },
];

export const registerGovernmentOfficial = [
    upload.fields([
        { name: 'governmentId', maxCount: 1 },
        { name: 'proofOfEmployment', maxCount: 1 },
    ]),
    async (req, res) => {
        const { name, email_id, password, mobile, department, designation, employee_id } = req.body;

        try {
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('email')
                .eq('email', email_id)
                .single();

            if (existingUser) {
                return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
            }
            

            const governmentId = req.files.governmentId[0];
        const proofOfEmployment = req.files.proofOfEmployment[0];
            // 1. Create the user in the 'users' table
            const { data: newUser, error: userError } = await supabase.from('users').insert([{
                name,
                email: email_id,
                phone: mobile,
                role: 'government',
                password, // Remember to hash passwords in production
                verify: 'unverified',
                status: 'pending'
            }]).select().single();

            if (userError) throw userError;

             const [idBuffer, proofBuffer] = await Promise.all([
                readFileAsync(governmentId.path),
                readFileAsync(proofOfEmployment.path)
            ]);

            // 2. Upload files to Supabase Storage
            const governmentIdPath = `public/government-documents/${newUser.id}/government_id.pdf`;
            const proofOfEmploymentPath = `public/government-documents/${newUser.id}/proof_of_employment.pdf`;

            const [idUpload, proofUpload] = await Promise.all([
                supabase.storage.from('documents').upload(governmentIdPath, idBuffer, { contentType: 'application/pdf' }),
                supabase.storage.from('documents').upload(proofOfEmploymentPath, proofBuffer, { contentType: 'application/pdf' })
            ]);

            if (idUpload.error || proofUpload.error) {
                throw new Error('File upload failed');
            }

            // 3. Insert into 'government_official_details' table
            const { error: detailsError } = await supabase.from('government_official_details').insert([{
                user_id: newUser.id,
                department,
                designation,
                employee_id,
                government_id_url: governmentIdPath,
                proof_of_employment_url: proofOfEmploymentPath
            }]);

            if (detailsError) throw detailsError;

            // 4. Clean up uploaded files from the server
            await Promise.all([
                unlinkAsync(governmentId.path),
                unlinkAsync(proofOfEmployment.path)
            ]);
            
            // 5. Send OTP for email verification
            GLOBAL_OTP = ""+Math.floor(100000 + Math.random() * 900000);
            await sendOtpEmail(email_id, GLOBAL_OTP);


            res.status(201).json({ 
                success: true, 
                message: 'Government official registration successful.',
                data: {
                    u_id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                }
            });

        } catch (error) {
            console.error('Government official registration error:', error);
            res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },
];
