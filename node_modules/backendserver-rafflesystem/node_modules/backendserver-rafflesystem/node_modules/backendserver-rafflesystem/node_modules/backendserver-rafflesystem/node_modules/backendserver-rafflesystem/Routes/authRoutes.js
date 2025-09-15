// routes/authRoutes.js
const express = require('express');
const { 
  registerUser, 
  loginUser, 
  verifyEmail, 
  forgotPassword,   
  resetPassword     
} = require('../controllers/authController');

const router = express.Router();

// Existing routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/verify-email', verifyEmail); // New route

// Forgot Password route
router.post('/forgot-password', forgotPassword); // Add forgot password route

// Reset Password route
router.post('/reset-password', resetPassword); // Add reset password route

module.exports = router;
