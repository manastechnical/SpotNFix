import nodemailer from 'nodemailer';

export const sendPotholeReappearedEmail = async (email, potholeDescription) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const subject = 'Urgent: A pothole you repaired has been re-reported';
        
    const htmlBody = `
        <p>Dear Contractor,</p>
        <p>This is an urgent notification regarding a pothole you previously repaired. A citizen has reported that the pothole has reappeared.</p>

        <p><strong>Action Taken:</strong></p>
        <p>The pothole status has been changed to 'reopened' and is now under official review. As per our agreement, your contract for this job has been marked as 'penalized'.</p>
        <p>Please log in to your SpotNFix dashboard immediately to view the details and any required next steps.</p>
        <p>Thank you for your attention to this matter.</p>
    `;

    const mailOptions = {
        from: `SpotNFix Admin <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: htmlBody,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Pothole reappeared email sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send pothole reappeared email to ${email}:`, error);
    }
};