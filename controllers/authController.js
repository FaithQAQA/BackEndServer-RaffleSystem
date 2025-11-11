const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../Models/User');
const sgMail = require('@sendgrid/mail');
const { google } = require('googleapis');

require('dotenv').config({ path: '../.env' });

// ======================= EMAIL SERVICE =======================
class EmailService {
  constructor() {
    this.GMAIL_CLIENT_ID = '251445098515-k5cem4udl9o0hjelcjqbjhmfme7e4ndr.apps.googleusercontent.com';
    this.GMAIL_CLIENT_SECRET = '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';
    this.GMAIL_REDIRECT_URI = 'https://developers.google.com/oauthplayground';
    this.GMAIL_REFRESH_TOKEN = '1//04wIR5Wqblu_nCgYIARAAGAQSNwF-L9IrcUh9wHSHL6khuPeWEcf0HpLm12zKZxjcv0mQRhBYUJ4jgGUrjsSSyDdXBd9kzdusSmQ';
    this.GMAIL_FROM_EMAIL = 'voicenotify2@gmail.com';
    this.SENDGRID_FROM_EMAIL = 'voicenotify2@gmail.com';

    this.initializeGmailClient();
    this.initializeSendGrid();
  }

  initializeGmailClient() {
    this.oAuth2Client = new google.auth.OAuth2(
      this.GMAIL_CLIENT_ID,
      this.GMAIL_CLIENT_SECRET,
      this.GMAIL_REDIRECT_URI
    );
    this.oAuth2Client.setCredentials({ refresh_token: this.GMAIL_REFRESH_TOKEN });
  }

  initializeSendGrid() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  async sendGmail(to, subject, htmlContent) {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
      const rawMessage = this.createGmailMessage(to, subject, htmlContent);
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: rawMessage },
      });

      return { success: true, service: 'gmail', messageId: response.data.id };
    } catch (error) {
      console.error('Gmail API Error:', error.message);
      return { success: false, service: 'gmail', error: error.message };
    }
  }

  createGmailMessage(to, subject, htmlContent) {
    const message = [
      `From: "Raffle System" <${this.GMAIL_FROM_EMAIL}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      '',
      htmlContent
    ].join('\r\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async sendSendGrid(to, subject, htmlContent) {
    try {
      const message = {
        to,
        from: this.SENDGRID_FROM_EMAIL,
        subject,
        html: htmlContent,
        text: this.stripHtmlTags(htmlContent),
      };

      const response = await sgMail.send(message);
      return {
        success: true,
        service: 'sendgrid',
        messageId: response[0].headers['x-message-id'],
      };
    } catch (error) {
      console.error('SendGrid Error:', error.message);
      return { success: false, service: 'sendgrid', error: error.message };
    }
  }

  stripHtmlTags(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  async sendEmail(to, subject, htmlContent) {
    const gmailResult = await this.sendGmail(to, subject, htmlContent);

    if (gmailResult.success) {
      console.log('Email sent via Gmail:', gmailResult.messageId);
      return gmailResult;
    }

    console.warn('Gmail failed, attempting SendGrid...');
    const sendGridResult = await this.sendSendGrid(to, subject, htmlContent);

    if (sendGridResult.success) {
      console.log('Email sent via SendGrid:', sendGridResult.messageId);
      return sendGridResult;
    }

    console.error('Both Gmail and SendGrid failed');
    throw new Error('All email services failed');
  }
}

const emailService = new EmailService();

// ======================= EMAIL TEMPLATES =======================
const EmailTemplates = {
  verificationEmail(username, verificationLink) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Welcome to TicketStack! 🎉</h2>
        <p>Dear ${username},</p>
        <p>Thank you for signing up. Please verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #667eea; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-size: 16px; font-weight: bold;">
            Verify My Email
          </a>
        </div>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p style="word-break: break-all; color: #667eea; background-color: #f8f9fa; 
                  padding: 10px; border-radius: 4px;">${verificationLink}</p>
        <p>Best regards,<br/>TicketStack Team</p>
      </div>
    `;
  },

  passwordResetEmail(username, resetLink) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <p>Dear ${username},</p>
        <p>Please click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #dc3545; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;">
            Reset My Password
          </a>
        </div>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>Best regards,<br/>TicketStack Team</p>
      </div>
    `;
  },

  passwordChangeConfirmation(username) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Password Changed Successfully</h2>
        <p>Dear ${username},</p>
        <p>Your password has been successfully changed.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #28a745;">
            <strong>✅ Password change completed at: ${new Date().toLocaleString()}</strong>
          </p>
        </div>
        <p>Best regards,<br/>TicketStack Team</p>
      </div>
    `;
  }
};

// ======================= AUTHENTICATION SERVICE =======================
class AuthenticationService {
  static async validateUserCredentials(email, password) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    await this.validateEmailVerification(user);
    await this.validateAccountLock(user);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.handleFailedLoginAttempt(user);
      throw new Error('Invalid email or password');
    }

    await this.resetLoginAttempts(user);
    return user;
  }

  static async validateEmailVerification(user) {
    if (!user.emailVerified && !user.isAdmin) {
      throw new Error('Please verify your email before logging in');
    }
  }

  static async validateAccountLock(user) {
    if (user.isLocked && user.lockUntil > Date.now()) {
      throw new Error(`Account locked. Try again after ${new Date(user.lockUntil).toLocaleString()}`);
    }
  }

  static async handleFailedLoginAttempt(user) {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= 3) {
      user.isLocked = true;
      user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
    }

    await user.save();
  }

  static async resetLoginAttempts(user) {
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockUntil = null;
    await user.save();
  }

  static generateAuthToken(user) {
    const payload = { id: user._id, isAdmin: user.isAdmin };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
  }
}

// ======================= USER SERVICE =======================
class UserService {
  static async findUserById(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  static async findUserByEmail(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('No user found with that email');
    }
    return user;
  }

  static async validateUniqueUsername(username, currentUserId = null) {
    const query = { username };
    if (currentUserId) {
      query._id = { $ne: currentUserId };
    }
    
    const existingUser = await User.findOne(query);
    if (existingUser) {
      throw new Error('Username is already taken');
    }
  }

  static async validateUniqueEmail(email, currentUserId = null) {
    const query = { email };
    if (currentUserId) {
      query._id = { $ne: currentUserId };
    }
    
    const existingUser = await User.findOne(query);
    if (existingUser) {
      throw new Error('Email is already registered');
    }
  }

  static async updateUserPassword(user, currentPassword, newPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to set new password');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
  }

  static sanitizeUserResponse(user) {
    return user.select('-password -resetToken -resetTokenExpiry -verificationToken');
  }
}

// ======================= EMAIL NOTIFICATION SERVICE =======================
class EmailNotificationService {
  static async sendVerificationEmail(user, frontendUrl) {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;

    const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const emailHtml = EmailTemplates.verificationEmail(user.username, verificationLink);

    await emailService.sendEmail(
      user.email,
      'Verify Your Email - TicketStack',
      emailHtml
    );
  }

  static async sendPasswordResetEmail(user, frontendUrl) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour

    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    const emailHtml = EmailTemplates.passwordResetEmail(user.username, resetLink);

    await emailService.sendEmail(
      user.email,
      'Password Reset Request - TicketStack',
      emailHtml
    );
  }

  static async sendPasswordChangeConfirmation(user) {
    const emailHtml = EmailTemplates.passwordChangeConfirmation(user.username);

    await emailService.sendEmail(
      user.email,
      'Password Changed Successfully - TicketStack',
      emailHtml
    );
  }
}

// ======================= CONTROLLERS =======================
const updateUserProfile = async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await UserService.findUserById(userId);

    if (username && username !== user.username) {
      await UserService.validateUniqueUsername(username, userId);
      user.username = username;
    }

    if (email && email !== user.email) {
      await UserService.validateUniqueEmail(email, userId);
      user.email = email;
      user.emailVerified = false;
      
      await EmailNotificationService.sendVerificationEmail(user, getFrontendUrl(req));
    }

    if (newPassword) {
      await UserService.updateUserPassword(user, currentPassword, newPassword);
      await EmailNotificationService.sendPasswordChangeConfirmation(user);
    }

    await user.save();
    const updatedUser = await UserService.sanitizeUserResponse(User.findById(userId));

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await UserService.sanitizeUserResponse(User.findById(userId));
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
};

const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    await UserService.validateUniqueEmail(email);
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      emailVerified: false,
    });

    await user.save();
    await EmailNotificationService.sendVerificationEmail(user, getFrontendUrl(req));

    res.status(201).json({ message: 'User registered successfully! Check your email for verification.' });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ message: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.emailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await UserService.findUserByEmail(email);
    
    await EmailNotificationService.sendPasswordResetEmail(user, getFrontendUrl(req));
    
    res.json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(400).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const user = await User.findOne({ resetToken: token });
    if (!user || (user.resetTokenExpiry && user.resetTokenExpiry < Date.now())) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    await EmailNotificationService.sendPasswordChangeConfirmation(user);

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error, please try again' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await AuthenticationService.validateUserCredentials(email, password);
    const token = AuthenticationService.generateAuthToken(user);

    res.json({ 
      message: "Login successful!", 
      token, 
      isAdmin: user.isAdmin, 
      id: user._id 
    });
  } catch (error) {
    console.error('Login error:', error);
    
    const statusCode = error.message.includes('locked') || 
                      error.message.includes('verify') || 
                      error.message.includes('Invalid') ? 400 : 500;
    
    res.status(statusCode).json({ message: error.message });
  }
};

// ======================= UTILITY FUNCTIONS =======================
const getFrontendUrl = (req) => {
  return req.headers.origin || 'https://raffle-system-lac.vercel.app';
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