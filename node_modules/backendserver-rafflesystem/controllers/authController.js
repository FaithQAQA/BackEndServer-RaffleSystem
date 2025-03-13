const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../Models/User');


require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your email password or app password
  },
});

// 📌 Register a New User
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    /* Validate password strength
    if (password.length < 8 || !/\d/.test(password) || !/[!@#$%^&*]/.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long, contain a number and a special character' });
    }
*/
    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    user = new User({
      username,
      email,
      password: hashedPassword,
      verificationToken,
    });

    await user.save();

    // Send verification email
    //const verificationLink = `${process.env.FRONTEND_URL}/api/auth/verify-email?token=${verificationToken}`;

    const frontendUrl = req.headers.origin || 'https://raffle-system-lac.vercel.app';
    const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;


    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email',
      html: `<p>Click <a href="${verificationLink}">here</a> to verify your email.</p>`,
    });

    res.status(201).json({ message: 'User registered successfully! Check your email for verification.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

//  Verify Email
const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.emailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 📌 Login User (Require Email Verification)
const loginUser = async (req, res) => {
  console.log("Login request received:", req.body);

  try {
    const user = await User.findOne({ email: req.body.email });
    console.log("User found:", user);

    if (!user) {
      console.log("User not found");
      return res.status(400).json({ type: 'credentials', message: 'Invalid email or password' });
    }

    console.log("Checking email verification...");
    if (!user.emailVerified && !user.isAdmin) {
      console.log("Email not verified & user is not admin");
      return res.status(400).json({ type: 'unverified', message: 'Please verify your email before logging in.' });
    }

    console.log("Checking if account is locked...");
    if (user.isLocked && user.lockUntil > Date.now()) {
      console.log("Account is locked until:", user.lockUntil);
      return res.status(400).json({ 
        type: 'locked', 
        message: `Account is locked. Try again after ${new Date(user.lockUntil).toLocaleString()}`,
        lockUntil: user.lockUntil 
      });
    }

    console.log("Checking password...");
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      console.log("Invalid password. Increasing failed login attempts...");
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 3) {
        console.log("Too many failed attempts. Locking account...");
        user.isLocked = true;
        user.lockUntil = Date.now() + 30 * 60 * 1000;
      }

      await user.save();
      return res.status(400).json({ type: 'credentials', message: 'Invalid email or password' });
    }

    console.log("Password is correct. Resetting failed login attempts...");
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockUntil = null;
    await user.save();

    console.log("Generating JWT token...");
    const payload = { id: user._id, isAdmin: user.isAdmin };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log("Login successful! Sending response.");
    res.json({ message: 'Login successful!', token });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ type: 'server', message: 'Server error' });
  }
};
module.exports = { registerUser, verifyEmail, loginUser };
