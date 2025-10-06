import nodemailer from 'nodemailer';

export const sendPotholeStatusEmail = async (email, status) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    let subject;
    let htmlBody;

    // Determine the email content based on the status
    switch (status) {
        case 'verified':
            subject = 'Your Pothole Report has been verified!';
            htmlBody = `<p>Thank you for your contribution! The pothole you reported has been verified and approved. It is now in the queue for bidding and repair.</p>`;
            break;
        case 'rejected':
            subject = 'Update on Your Pothole Report';
            htmlBody = `<p>Thank you for your submission. After review, the pothole you reported has been discarded. This may be because it was a duplicate report, not a pothole, or for other administrative reasons.</p>`;
            break;
        default:
            // Optional: handle other statuses or do nothing
            return; 
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: htmlBody,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Pothole status email sent to ${email} for status: ${status}`);
    } catch (error) {
        console.error(`Failed to send pothole status email to ${email}:`, error);
    }
};