import nodemailer from 'nodemailer';

/**
 * Sends an email to a user notifying them that a pothole they reported has been fixed.
 * @param {string} email - The email address of the original reporter.
 * @param {string} potholeDescription - The description of the now-fixed pothole.
 */
export const sendPotholeFixedEmail = async (email, potholeDescription) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const subject = 'Update: The pothole you reported has been fixed!';
        
    const htmlBody = `
        <p>Dear Citizen,</p>
        <p>Great news! The pothole you reported has been successfully repaired. Your contribution is helping make our roads safer.</p>
        <h3>Report Details:</h3>
        <ul>
            <li><strong>Pothole:</strong> ${potholeDescription}</li>
            <li><strong>Status:</strong> Repaired</li>
        </ul>
        <p>Thank you again for your vigilance and for using SpotNFix.</p>
    `;

    const mailOptions = {
        from: `SpotNFix <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: htmlBody,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Pothole fixed notification sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send pothole fixed email to ${email}:`, error);
    }
};