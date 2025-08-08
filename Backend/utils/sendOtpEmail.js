import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,     // Your Gmail
    pass: process.env.EMAIL_PASS,     // App password (not regular password)
  },
});

export const sendOtpEmail = async (toEmail, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`,
  };

  await transporter.sendMail(mailOptions);
};
