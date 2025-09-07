import nodemailer from 'nodemailer';

export const sendVerificationEmail = async (email, status) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const subject = status === 'approved' 
        ? 'Your SpotNFix Account has been Approved!' 
        : 'Update on Your SpotNFix Account Verification';
        
    const htmlBody = status === 'approved'
        ? `<p>Congratulations! Your account has been verified by our admin. You can now log in and access all features.</p>`
        : `<p>We regret to inform you that your account verification has been rejected. Please review our terms or contact support for more information.</p>`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: htmlBody,
    };

    await transporter.sendMail(mailOptions);
};