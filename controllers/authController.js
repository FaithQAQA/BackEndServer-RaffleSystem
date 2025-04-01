const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../Models/User'); // Ensure correct path

require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 📌 Register User
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    console.log("🔹 [REGISTER] Incoming request:", req.body);

    let user = await User.findOne({ email });
    if (user) {
      console.log("❌ [REGISTER] User already exists:", email);
      return res.status(400).json({ message: 'User already exists' });
    }

    // ✅ Uncomment this if you want password validation
    /*
    if (password.length < 8 || !/\d/.test(password) || !/[!@#$%^&*]/.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long, contain a number and a special character' });
    }
    */

    // Hash password
    console.log("🔹 [REGISTER] Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    user = new User({
      username,
      email,
      password: hashedPassword,
      verificationToken,
      emailVerified: false,
    });

    await user.save();
    console.log("✅ [REGISTER] User saved:", user.email);

    // Construct verification link
    const frontendUrl = req.headers.origin || 'https://raffle-system-lac.vercel.app' || 'https://raffle-system-git-main-faithqaqas-projects.vercel.app';
    const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
    
    // Send verification email
    try {
      console.log("🔹 [REGISTER] Sending verification email to:", email);

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification Required',
        html: `
          <p>Dear ${username},</p>
          <p>Thank you for signing up. Please verify your email by clicking the link below:</p>
          <p><a href="${verificationLink}" style="color: #007bff; text-decoration: none;">Verify My Email</a></p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,</p>
          <p>Your Company Name</p>
        `,
      });

      console.log("✅ [REGISTER] Verification email sent.");
    } catch (emailError) {
      console.error("❌ [REGISTER] Error sending email:", emailError);
      return res.status(201).json({ message: 'User registered, but email sending failed.' });
    }

    res.status(201).json({ message: 'User registered successfully! Check your email for verification.' });
  } catch (err) {
    console.error("❌ [REGISTER] Server error:", err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 📌 Verify Email
const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    console.log("🔹 [VERIFY] Token received:", token);
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      console.log("❌ [VERIFY] Invalid token");
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.emailVerified = true;
    user.verificationToken = null;
    await user.save();
    console.log("✅ [VERIFY] Email verified for:", user.email);

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error("❌ [VERIFY] Server error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};



// 📌 Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'No user found with that email' });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    // Send password reset email
    const frontendUrl = req.headers.origin || 'https://raffle-system-lac.vercel.app' || 'https://raffle-system-git-main-faithqaqas-projects.vercel.app';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>Dear ${user.username},</p>
        <p>We received a request to reset your password. Please click the link below to reset it:</p>
        <p><a href="${resetLink}" style="color: #007bff; text-decoration: none;">Reset My Password</a></p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,</p>
        <p>Your Company Name</p>
      `,
    });

    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error("❌ [FORGOT PASSWORD] Server error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};




// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Find user by reset token
    const user = await User.findOne({ resetToken: token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Check if token is expired
    if (user.resetTokenExpiry && user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error, please try again' });
  }
};


// 📌 Login User (Require Email Verification)
const loginUser = async (req, res) => {
  console.log("🔹 [LOGIN] Request received:", req.body);

  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      console.log("❌ [LOGIN] User not found:", req.body.email);
      return res.status(400).json({ type: "credentials", message: "Invalid email or password" });
    }

    // Require email verification unless admin
    if (!user.emailVerified && !user.isAdmin) {
      console.log("❌ [LOGIN] Email not verified");
      return res.status(400).json({ type: "unverified", message: "Please verify your email before logging in." });
    }

    // Handle account lock
    if (user.isLocked && user.lockUntil > Date.now()) {
      console.log(`❌ [LOGIN] Account locked until: ${new Date(user.lockUntil).toLocaleString()}`);
      return res.status(400).json({ 
        type: "locked", 
        message: `Account locked. Try again after ${new Date(user.lockUntil).toLocaleString()}`,
        lockUntil: user.lockUntil 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      console.log("❌ [LOGIN] Incorrect password");
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 3) {
        console.log("❌ [LOGIN] Locking account due to failed attempts");
        user.isLocked = true;
        user.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
      }

      await user.save();
      return res.status(400).json({ type: "credentials", message: "Invalid email or password" });
    }

    // Reset failed attempts & unlock account
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockUntil = null;
    await user.save();

    // Generate JWT token
    console.log("✅ [LOGIN] Login successful! Generating token...");
    const payload = { id: user._id, isAdmin: user.isAdmin };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ message: "Login successful!", token, isAdmin: user.isAdmin, id: user._id  });
  } catch (err) {
    console.error("❌ [LOGIN] Server error:", err);
    res.status(500).json({ type: "server", message: "Server error" });
  }
};

module.exports = { 
  registerUser, 
  verifyEmail, 
  loginUser, 
  forgotPassword, 
  resetPassword 
};

