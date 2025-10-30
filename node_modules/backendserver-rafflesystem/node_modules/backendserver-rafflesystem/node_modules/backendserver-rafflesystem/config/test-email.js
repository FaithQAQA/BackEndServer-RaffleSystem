const nodemailer = require('nodemailer');
require('dotenv').config({ path: '../.env' }); // point to project root
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS);


// ✅ Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password without spaces
  },
});

// ------------------- TEST EMAIL FUNCTION -------------------
const testEmail = async (toEmail) => {
  try {
    console.log("Testing email to:", toEmail);

    // Verify SMTP connection first
    await transporter.verify();
    console.log("SMTP Server is ready ✅");

    // Send a test email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: 'Test Email from Raffle System',
      text: 'This is a test email to verify SMTP configuration.',
      html: `<p>This is a test email to verify <b>SMTP configuration</b>.</p>`
    });

    console.log(`Test email sent successfully to ${toEmail} ✅`);
  } catch (err) {
    console.error("Test email failed ❌", err);
  }
};

// ------------------- RUN TEST -------------------
// Replace with your email
testEmail('jalani.maynard@gmail.com');
