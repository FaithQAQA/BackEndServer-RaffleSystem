const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  registerUser,
  verifyEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  updateUserProfile,
  getUserProfile
} = require('../controllers/authController');

// Public routes
router.post('/register', registerUser);
router.get('/verify-email', verifyEmail);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Test your Single Sender configuration
app.get('/api/email/test', async (req, res) => {
  try {
    const status = emailService.getStatus();
    
    if (!status.initialized) {
      return res.json({
        success: false,
        error: 'Email service not initialized',
        status: status,
        fix: 'Check SENDGRID_API_KEY in Render environment variables'
      });
    }

    // Test sending to the verified sender itself
    const testResult = await emailService.testConfiguration();
    
    res.json({
      success: testResult.success,
      testResult: testResult,
      status: status,
      instructions: [
        '1. SENDGRID_FROM_EMAIL should be: voicenotify2@gmail.com',
        '2. SENDGRID_API_KEY should be a valid key from SendGrid',
        '3. Single Sender shows as "verified" in SendGrid dashboard'
      ]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      status: emailService.getStatus()
    });
  }
});

// Quick status check
app.get('/api/email/status', (req, res) => {
  res.json(emailService.getStatus());
});

// Protected routes (require authentication)
router.get('/profile', auth, getUserProfile);
router.put('/profile', auth, updateUserProfile);

module.exports = router;