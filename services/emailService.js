// services/emailService.js
const sgMail = require('@sendgrid/mail');

class EmailService {
  constructor() {
    this.verifiedSender = 'voicenotify2@gmail.com'; // Hardcoded for safety
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      console.error('❌ SENDGRID_API_KEY is missing from Render environment variables');
      return;
    }

    // Override any environment variable with your verified sender
    const fromEmail = this.verifiedSender; // Always use the verified one
    const fromName = process.env.SENDGRID_FROM_NAME || 'TicketStack';

    try {
      sgMail.setApiKey(apiKey);
      this.isInitialized = true;
      
      console.log('✅ SendGrid Initialized for Single Sender');
      console.log('📧 Verified Sender:', fromEmail);
      console.log('🏷️  From Name:', fromName);
      console.log('🔑 API Key:', apiKey ? 'Present' : 'Missing');
      
    } catch (error) {
      console.error('❌ SendGrid initialization failed:', error.message);
    }
  }

  async sendEmail(to, subject, html, text = '') {
    if (!this.isInitialized) {
      throw new Error('SendGrid not initialized. Check API key and environment variables on Render.');
    }

    // Always use the verified sender
    const msg = {
      to: to.trim(),
      from: {
        email: this.verifiedSender, // Your verified email
        name: process.env.SENDGRID_FROM_NAME || 'TicketStack',
      },
      subject: subject.trim(),
      html: html,
      text: text || this.htmlToText(html),
    };

    console.log(`📧 Sending from verified sender:`, {
      from: msg.from.email,
      to: msg.to,
      subject: msg.subject.substring(0, 50) + '...'
    });

    try {
      const [result] = await sgMail.send(msg);
      console.log('✅ Email sent successfully via Single Sender');
      return { 
        success: true, 
        messageId: result?.headers?.['x-message-id'],
        statusCode: result?.statusCode 
      };
    } catch (error) {
      console.error('❌ SendGrid Error:', error.message);
      
      if (error.response) {
        console.error('Status Code:', error.response.statusCode);
        console.error('Error Details:', JSON.stringify(error.response.body, null, 2));
      }

      // Specific error handling
      if (error.code === 401) {
        throw new Error('Invalid SendGrid API key. Generate a new one in SendGrid dashboard.');
      } else if (error.code === 403) {
        throw new Error('Sender not properly verified. Check Single Sender Verification in SendGrid.');
      } else {
        throw new Error(`Email failed: ${error.message}`);
      }
    }
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Test your specific configuration
  async testConfiguration() {
    if (!this.isInitialized) {
      return { success: false, error: 'SendGrid not initialized' };
    }

    try {
      const result = await this.sendEmail(
        this.verifiedSender, // Send test to yourself
        'TicketStack - SendGrid Test',
        `
          <h1>🎉 SendGrid Test Successful!</h1>
          <p>Your Single Sender Verification is working correctly.</p>
          <p><strong>Verified Sender:</strong> ${this.verifiedSender}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Backend:</strong> Render</p>
          <p><strong>Frontend:</strong> Vercel</p>
          <hr>
          <p>If you received this, your TicketStack email system is ready! 🎟️</p>
        `
      );

      return { success: true, result };

    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        verifiedSender: this.verifiedSender
      };
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      verifiedSender: this.verifiedSender,
      fromName: process.env.SENDGRID_FROM_NAME || 'TicketStack',
      apiKeyExists: !!process.env.SENDGRID_API_KEY,
      apiKeyLength: process.env.SENDGRID_API_KEY?.length,
      backend: 'Render',
      frontend: 'Vercel'
    };
  }
}

module.exports = new EmailService();