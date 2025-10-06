import nodemailer from 'nodemailer';

export const sendContractAssignEmail = async (email, description) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });



    const subject = 'Congratulations! You have won the bid and assigned a new contract on SpotNFix!';
        
    const htmlBody = `
        <p>Dear Contractor,</p>
        <p>Congratulations! Your bid has been accepted for a new pothole repair contract.</p>
        <h3>Contract Details:</h3>
        <ul>
            <li><strong>Pothole:</strong> ${description}</li>
        </ul>
        <p>Please log in to your SpotNFix dashboard to view the full contract details and begin the repair work.</p>
        <p>Thank you for your service.</p>
    `;

    const mailOptions = {
        from: `SpotNFix Admin <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: htmlBody,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Contract awarded email sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send contract awarded email to ${email}:`, error);
    }
};