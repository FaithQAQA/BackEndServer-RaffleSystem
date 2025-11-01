const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../Models/User');
const sgMail = require('@sendgrid/mail');

require('dotenv').config({ path: '../.env' });

// ======================= ✅ SENDGRID EMAIL FUNCTION =======================
const sendEmail = async (to, subject, html) => {
  const msg = {
    to: to,
    from: 'voicenotify2@gmail.com', // ✅ Use your verified SendGrid email
    subject: subject,
    html: html,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email sent successfully via SendGrid API');
    return true;
  } catch (error) {
    console.error('❌ SendGrid API error:', error);
    throw error;
  }
};

// ================= UPDATE USER PROFILE =================
const updateUserProfile = async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const userId = req.user.id; // From auth middleware

    console.log("UPDATE PROFILE Request received for user:", userId);

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if username is taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      user.username = username;
    }

    // Check if email is taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email is already registered' });
      }
      user.email = email;
      user.emailVerified = false; // Require re-verification if email changed
      
      // Send verification email for new email
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.verificationToken = verificationToken;

      const frontendUrl = req.headers.origin || 'https://raffle-system-lac.vercel.app';
      const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

      try {
        const emailHtml = `
          <p>Dear ${user.username},</p>
          <p>Please verify your new email address by clicking the link below:</p>
          <p><a href="${verificationLink}" style="color: #007bff; text-decoration: none;">Verify My Email</a></p>
          <p>If you did not request this change, please contact support immediately.</p>
          <p>Best regards,<br/>TicketStack Team</p>
        `;

        await sendEmail(
          email,
          'Verify Your New Email Address',
          emailHtml
        );

        console.log(`✅ Verification email sent to new email: ${email}`);
      } catch (emailError) {
        console.error("❌ Error sending verification email:", emailError);
        // Continue with profile update even if email fails
      }
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set new password' });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;

      // Send password change confirmation email
      try {
        const emailHtml = `
          <p>Dear ${user.username},</p>
          <p>Your password has been successfully changed.</p>
          <p>If you did not make this change, please contact support immediately.</p>
          <p>Best regards,<br/>TicketStack Team</p>
        `;

        await sendEmail(
          user.email,
          'Password Changed Successfully',
          emailHtml
        );

        console.log(`✅ Password change confirmation sent to: ${user.email}`);
      } catch (emailError) {
        console.error("❌ Error sending password change confirmation:", emailError);
        // Continue with profile update even if email fails
      }
    }

    await user.save();

    // Return updated user data (excluding sensitive fields)
    const updatedUser = await User.findById(userId).select('-password -resetToken -resetTokenExpiry -verificationToken');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('UPDATE PROFILE Server error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

// ================= GET USER PROFILE =================
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    const user = await User.findById(userId).select('-password -resetToken -resetTokenExpiry -verificationToken');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user
    });
  } catch (error) {
    console.error('GET PROFILE Server error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
};

// ================= REGISTER USER =================
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

    // Send verification email using consistent sendEmail function
    try {
      const emailHtml = `
        <p>Dear ${username},</p>
        <p>Thank you for signing up. Please verify your email by clicking the link below:</p>
        <p><a href="${verificationLink}" style="color: #007bff; text-decoration: none;">Verify My Email</a></p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br/>TicketStack Team</p>
      `;

      await sendEmail(
        email,
        'Email Verification Required',
        emailHtml
      );

      console.log(`✅ Verification email sent to ${email}`);
    } catch (emailError) {
      console.error("❌ Error sending verification email:", emailError);
      // Don't throw error to user, just log it
    }

  } catch (err) {
    console.error("REGISTER Server error:", err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ================= VERIFY EMAIL =================
const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    console.log("VERIFY Token received:", token);
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      console.log("[VERIFY] Invalid token");
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.emailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error("VERIFY Server error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= FORGOT PASSWORD =================
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
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const frontendUrl = req.headers.origin || 'https://raffle-system-lac.vercel.app';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send password reset email using consistent sendEmail function
    try {
      const emailHtml = `
        <p>Dear ${user.username},</p>
        <p>We received a request to reset your password. Please click the link below to reset it:</p>
        <p><a href="${resetLink}" style="color: #007bff; text-decoration: none;">Reset My Password</a></p>
        <p>If you did not request this, please ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
        <p>Best regards,<br/>TicketStack Team</p>
      `;

      await sendEmail(
        email,
        'Password Reset Request',
        emailHtml
      );

      console.log(`✅ Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error("❌ Error sending password reset email:", emailError);
      return res.status(500).json({ message: 'Error sending reset email' });
    }

    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error("FORGOT PASSWORD Server error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= RESET PASSWORD =================
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const user = await User.findOne({ resetToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (user.resetTokenExpiry && user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    // Send confirmation email
    try {
      const emailHtml = `
        <p>Dear ${user.username},</p>
        <p>Your password has been successfully reset.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <p>Best regards,<br/>TicketStack Team</p>
      `;

      await sendEmail(
        user.email,
        'Password Reset Successful',
        emailHtml
      );

      console.log(`✅ Password reset confirmation sent to ${user.email}`);
    } catch (emailError) {
      console.error("❌ Error sending password reset confirmation:", emailError);
      // Don't fail the reset process if email fails
    }

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error, please try again' });
  }
};

// ================= LOGIN USER =================
const loginUser = async (req, res) => {
  console.log("LOGIN Request received:", req.body);

  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      console.log("LOGIN User not found:", req.body.email);
      return res.status(400).json({ type: "credentials", message: "Invalid email or password" });
    }

    // Require email verification unless admin
    if (!user.emailVerified && !user.isAdmin) {
      console.log("LOGIN Email not verified");
      return res.status(400).json({ type: "unverified", message: "Please verify your email before logging in." });
    }

    // Handle account lock
    if (user.isLocked && user.lockUntil > Date.now()) {
      console.log(`LOGIN Account locked until: ${new Date(user.lockUntil).toLocaleString()}`);
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
        user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
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

    res.json({ message: "Login successful!", token, isAdmin: user.isAdmin, id: user._id });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ type: "server", message: "Server error" });
  }
};

module.exports = { 
  registerUser, 
  verifyEmail, 
  loginUser, 
  forgotPassword, 
  resetPassword,
  updateUserProfile,
  getUserProfile
};