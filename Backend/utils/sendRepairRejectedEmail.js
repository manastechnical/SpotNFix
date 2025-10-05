import nodemailer from 'nodemailer';

/**
 * Sends an email to a contractor notifying them that their repair work was rejected.
 * @param {string} email - The contractor's email address.
 * @param {string} potholeDescription - The description of the pothole with the rejected repair.
 */
export const sendRepairRejectedEmail = async (email, potholeDescription) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const subject = 'Action Required: Your pothole repair has been rejected';
        
    const htmlBody = `
        <p>Dear Contractor,</p>
        <p>This is a notification regarding the repair work you submitted for a pothole. After a final review by an official, your work has been rejected.</p>
        <p><strong>Next Steps:</strong></p>
        <p>Your contract for this pothole has been reset to 'ongoing', and a penalty has been recorded on your account. Please log in to your SpotNFix dashboard for more details and to review the required actions.</p>
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
        console.log(`Repair rejection email sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send repair rejection email to ${email}:`, error);
    }
};