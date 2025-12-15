import nodemailer from 'nodemailer';

export const sendBlacklistEmail = async (email, potholeDescription) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const subject = 'Urgent: You have been blacklisted due to pothole reappearance';

    const htmlBody = `
        <p>Dear Contractor,</p>
        <p>This is a formal notification that your SpotNFix account has been <strong>blacklisted</strong> effective immediately.</p>

        <p><strong>Reason:</strong></p>
        <p>You have accumulated 10 or more penalties on your account due to repeated contract violations or poor quality work.</p>

        <p><strong>Consequences:</strong></p>
        <p>Your ability to submit bids for new potholes has been revoked. You will no longer be able to participate in new contracts on the platform.</p>

        <p>If you believe this is an error, please contact the administration team.</p>
        <p>SpotNFix Admin Team</p>
    `;

    const mailOptions = {
        from: `SpotNFix Admin <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: htmlBody,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Blacklist email sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send blacklist email to ${email}:`, error);
    }
};