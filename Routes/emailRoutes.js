// routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// Test Single Sender configuration
router.get('/test', async (req, res) => {
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

// Email status
router.get('/status', (req, res) => {
  res.json(emailService.getStatus());
});

// Send test email to specific address
router.post('/test-send', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const result = await emailService.sendEmail(
      email,
      'TicketStack - Email Test',
      `
        <h1>🎉 Email Test Successful!</h1>
        <p>Your TicketStack email system is working correctly.</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>From:</strong> voicenotify2@gmail.com</p>
        <p><strong>Backend:</strong> Render</p>
        <hr>
        <p>If you received this, your email configuration is perfect! 🎟️</p>
      `
    );

    res.json({ success: true, result });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      status: emailService.getStatus()
    });
  }
});

module.exports = router;