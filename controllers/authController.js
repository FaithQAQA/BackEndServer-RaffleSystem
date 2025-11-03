const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../Models/User');
const sgMail = require('@sendgrid/mail');
const { google } = require('googleapis');

require('dotenv').config({ path: '../.env' });

// ======================= ✅ EMAIL SERVICE CLASS =======================
class EmailService {
  constructor() {
    // ---------- Gmail API ----------
    this.GMAIL_CLIENT_ID = '251445098515-k5cem4udl9o0hjelcjqbjhmfme7e4ndr.apps.googleusercontent.com';
    this.GMAIL_CLIENT_SECRET = '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';
    this.GMAIL_REDIRECT_URI = 'https://developers.google.com/oauthplayground';
    this.GMAIL_REFRESH_TOKEN = '1//04wIR5Wqblu_nCgYIARAAGAQSNwF-L9IrcUh9wHSHL6khuPeWEcf0HpLm12zKZxjcv0mQRhBYUJ4jgGUrjsSSyDdXBd9kzdusSmQ';
    this.GMAIL_FROM_EMAIL = 'voicenotify2@gmail.com';

    this.oAuth2Client = new google.auth.OAuth2(
      this.GMAIL_CLIENT_ID,
      this.GMAIL_CLIENT_SECRET,
      this.GMAIL_REDIRECT_URI
    );
    this.oAuth2Client.setCredentials({ refresh_token: this.GMAIL_REFRESH_TOKEN });

    // ---------- SendGrid ----------
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.SENDGRID_FROM_EMAIL = 'voicenotify2@gmail.com'; // same from email
  }

  // ---------- Gmail API Send (HTML supported) ----------
  async sendGmail(to, subject, htmlContent) {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });

      // Proper MIME headers for HTML
      const rawMessage = Buffer.from(
        `From: "Raffle System" <${this.GMAIL_FROM_EMAIL}>\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
        `${htmlContent}`
      )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: rawMessage },
      });

      return { success: true, service: 'gmail', messageId: res.data.id };
    } catch (error) {
      console.error('❌ Gmail API Error:', error.message || error);
      return { success: false, service: 'gmail', error: error.message };
    }
  }

  // ---------- SendGrid Send ----------
  async sendSendGrid(to, subject, htmlContent) {
    try {
      const msg = {
        to,
        from: this.SENDGRID_FROM_EMAIL,
        subject,
        html: htmlContent,
        text: htmlContent.replace(/<[^>]*>/g, ''), // fallback plain text
      };

      const res = await sgMail.send(msg);
      return {
        success: true,
        service: 'sendgrid',
        messageId: res[0].headers['x-message-id'],
      };
    } catch (error) {
      console.error('❌ SendGrid Error:', error.message || error);
      return { success: false, service: 'sendgrid', error: error.message };
    }
  }

  // ---------- Unified Send (Gmail + SendGrid fallback) ----------
  async sendEmail(to, subject, htmlContent) {
    const gmailResult = await this.sendGmail(to, subject, htmlContent);

    if (gmailResult.success) {
      console.log('✅ Email sent via Gmail:', gmailResult.messageId);
      return gmailResult;
    }

    console.warn('⚠️ Gmail failed, attempting SendGrid...');
    const sendGridResult = await this.sendSendGrid(to, subject, htmlContent);

    if (sendGridResult.success) {
      console.log('✅ Email sent via SendGrid:', sendGridResult.messageId);
      return sendGridResult;
    }

    console.error('❌ Both Gmail and SendGrid failed.');
    return {
      success: false,
      error: 'Both services failed',
      details: [gmailResult, sendGridResult],
    };
  }
}

// Create email service instance
const emailService = new EmailService();

// ======================= ✅ UNIFIED EMAIL FUNCTION =======================
const sendEmail = async (to, subject, html) => {
  try {
    const result = await emailService.sendEmail(to, subject, html);
    
    if (result.success) {
      console.log(`✅ Email sent successfully via ${result.service}`);
      return true;
    } else {
      console.error('❌ Email sending failed via all services:', result.error);
      throw new Error(`Email sending failed: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Unified email function error:', error);
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
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">Verify Your New Email Address</h2>
            <p>Dear ${user.username},</p>
            <p>Please verify your new email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" 
                 style="background-color: #667eea; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 8px; display: inline-block;">
                Verify My Email
              </a>
            </div>
            <p>If the button doesn't work, copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationLink}</p>
            <p>If you did not request this change, please contact support immediately.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">Best regards,<br/>TicketStack Team</p>
          </div>
        `;

        await sendEmail(
          email,
          'Verify Your New Email Address - TicketStack',
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
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">Password Changed Successfully</h2>
            <p>Dear ${user.username},</p>
            <p>Your password has been successfully changed.</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #28a745;">
                <strong>✅ Password change completed at: ${new Date().toLocaleString()}</strong>
              </p>
            </div>
            <p>If you did not make this change, please contact support immediately.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">Best regards,<br/>TicketStack Team</p>
          </div>
        `;

        await sendEmail(
          user.email,
          'Password Changed Successfully - TicketStack',
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

    // Send verification email using unified email function
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Welcome to TicketStack! 🎉</h2>
          <p>Dear ${username},</p>
          <p>Thank you for signing up for TicketStack. To get started, please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #667eea; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 8px; display: inline-block;
                      font-size: 16px; font-weight: bold;">
              Verify My Email
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #667eea; background-color: #f8f9fa; 
                    padding: 10px; border-radius: 4px;">${verificationLink}</p>
          <p>This verification link will expire in 24 hours.</p>
          <p>If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 14px;">Best regards,<br/>TicketStack Team</p>
        </div>
      `;

      await sendEmail(
        email,
        'Verify Your Email - TicketStack',
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

    // Send password reset email using unified email function
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
          <p>Dear ${user.username},</p>
          <p>We received a request to reset your password. Please click the button below to reset it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #dc3545; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 8px; display: inline-block;">
              Reset My Password
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 14px;">Best regards,<br/>TicketStack Team</p>
        </div>
      `;

      await sendEmail(
        email,
        'Password Reset Request - TicketStack',
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745; text-align: center;">Password Reset Successful ✅</h2>
          <p>Dear ${user.username},</p>
          <p>Your password has been successfully reset.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #28a745;">
              <strong>Password reset completed at: ${new Date().toLocaleString()}</strong>
            </p>
          </div>
          <p>If you did not make this change, please contact support immediately.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 14px;">Best regards,<br/>TicketStack Team</p>
        </div>
      `;

      await sendEmail(
        user.email,
        'Password Reset Successful - TicketStack',
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