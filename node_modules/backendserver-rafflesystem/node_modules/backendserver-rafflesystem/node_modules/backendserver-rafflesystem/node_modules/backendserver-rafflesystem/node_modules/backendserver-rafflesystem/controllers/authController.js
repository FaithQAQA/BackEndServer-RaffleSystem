const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../Models/User'); 

require('dotenv').config({ path: '../.env' }); // point to project root

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    console.log("REGISTER Incoming request:", req.body);

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = new User({
      username,
      email,
      password: hashedPassword,
      verificationToken,
      emailVerified: false,
    });

    await user.save();

    const frontendUrl = req.headers.origin || 'https://raffle-system-lac.vercel.app';
    const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

    // Respond immediately
    res.status(201).json({ message: 'User registered successfully! Check your email for verification.' });

    // Send email asynchronously (fire-and-forget)
    transporter.sendMail({
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
    }).catch(err => console.error("Error sending email:", err));

  } catch (err) {
    console.error("REGISTER Server error:", err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    console.log(" VERIFY Token received:", token);
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      console.log(" [VERIFY] Invalid token");
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.emailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error(" VERIFY Server error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};



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
    console.error(" FORGOT PASSWORD Server error:", err);
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


const loginUser = async (req, res) => {
  console.log("LOGIN Request received:", req.body);

  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      console.log(" LOGIN User not found:", req.body.email);
      return res.status(400).json({ type: "credentials", message: "Invalid email or password" });
    }

    // Require email verification unless admin
    if (!user.emailVerified && !user.isAdmin) {
      console.log(" LOGIN Email not verified");
      return res.status(400).json({ type: "unverified", message: "Please verify your email before logging in." });
    }

    // Handle account lock
    if (user.isLocked && user.lockUntil > Date.now()) {
      console.log(` LOGIN Account locked until: ${new Date(user.lockUntil).toLocaleString()}`);
      return res.status(400).json({ 
        type: "locked", 
        message: `Account locked. Try again after ${new Date(user.lockUntil).toLocaleString()}`,
        lockUntil: user.lockUntil 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 3) {
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
    const payload = { id: user._id, isAdmin: user.isAdmin };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ message: "Login successful!", token, isAdmin: user.isAdmin, id: user._id  });
  } catch (err) {
    console.error(" Server error:", err);
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

