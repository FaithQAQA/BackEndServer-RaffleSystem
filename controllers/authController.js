// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../Models/User');

// Register a new user
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({ username, email, password });
    await user.save();

    const payload = { id: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ type: 'credentials', message: 'Invalid email or password' });
    }

    // Check if account is locked
    if (user.isLocked && user.lockUntil > Date.now()) {
      const unlockTime = new Date(user.lockUntil).toLocaleString(); // Convert to readable format
      return res.status(400).json({ 
        type: 'locked', 
        message: `Account is locked. Try again after ${unlockTime}`,
        lockUntil: user.lockUntil 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;

      // Lock account after 3 failed attempts
      if (user.failedLoginAttempts >= 3) {
        user.isLocked = true;
        user.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
      }

      await user.save();
      return res.status(400).json({ type: 'credentials', message: 'Invalid email or password' });
    }

    // Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockUntil = null;
    await user.save();

    const payload = { id: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ type: 'server', message: 'Server error' });
  }
};

module.exports = { registerUser, loginUser };