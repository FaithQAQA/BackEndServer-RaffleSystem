const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');
const emailService = require('../services/emailService');

// ======================= PUBLIC AUTH ROUTES =======================
router.post('/register', authController.registerUser);
router.get('/verify-email', authController.verifyEmail);
router.post('/login', authController.loginUser);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/resend-verification', authController.resendVerificationEmail);

// ======================= EMAIL SERVICE ROUTES =======================
router.get('/email/status', (req, res) => {
  try {
    const serviceStatus = emailService.getStatus();
    res.json({
      success: true,
      status: serviceStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve email service status',
      details: error.message
    });
  }
});

router.get('/email/test', async (req, res) => {
  try {
    const serviceStatus = emailService.getStatus();
    
    if (!serviceStatus.initialized) {
      return res.status(503).json({
        success: false,
        error: 'Email service not properly initialized',
        status: serviceStatus,
        troubleshooting: [
          '1. Verify SENDGRID_API_KEY is set in environment variables',
          '2. Ensure SENDGRID_FROM_EMAIL is set to: voicenotify2@gmail.com',
          '3. Confirm sender email is verified in SendGrid dashboard',
          '4. Check SendGrid account has sufficient sending capacity',
          '5. Verify network connectivity to SendGrid API'
        ]
      });
    }

    const testResult = await emailService.testConfiguration();
    
    res.json({
      success: testResult.success,
      testResult: testResult,
      status: serviceStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Email service test failed',
      details: error.message,
      status: emailService.getStatus()
    });
  }
});

// ======================= PROTECTED PROFILE ROUTES =======================
router.get('/profile', authMiddleware, authController.getUserProfile);
router.put('/profile', authMiddleware, authController.updateUserProfile);

// ======================= HEALTH CHECK =======================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes are functioning properly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;