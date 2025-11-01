const sgMail = require('@sendgrid/mail');

class EmailService {
  constructor() {
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      console.error('❌ SENDGRID_API_KEY is missing from environment variables');
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('SG.') || apiKey.length < 50) {
      console.error('❌ Invalid SendGrid API key format. Should start with "SG." and be ~70 characters');
      return;
    }

    try {
      sgMail.setApiKey(apiKey);
      this.isInitialized = true;
      console.log('✅ SendGrid initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize SendGrid:', error.message);
    }
  }

  async sendEmail(to, subject, html, text = '') {
    if (!this.isInitialized) {
      throw new Error('SendGrid not initialized - check API key configuration');
    }

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@ticketstack.com';
    const fromName = process.env.SENDGRID_FROM_NAME || 'TicketStack';

    const msg = {
      to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject,
      html,
      text: text || this.htmlToText(html),
    };

    console.log(`📧 Sending email to: ${to}, Subject: ${subject}`);

    try {
      const result = await sgMail.send(msg);
      console.log('✅ Email sent successfully');
      return { success: true, messageId: result[0]?.headers['x-message-id'] };
    } catch (error) {
      console.error('❌ SendGrid API error:', error.message);
      
      if (error.response) {
        console.error('SendGrid response body:', JSON.stringify(error.response.body, null, 2));
      }
      
      throw error;
    }
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Test method to verify configuration
  async testConfiguration() {
    if (!this.isInitialized) {
      return { success: false, error: 'SendGrid not initialized' };
    }

    try {
      // Simple test - try to get account info
      const client = require('@sendgrid/client');
      client.setApiKey(process.env.SENDGRID_API_KEY);
      
      const request = {
        method: 'GET',
        url: '/v3/user/account'
      };
      
      const [response] = await client.request(request);
      return { success: true, account: response.body };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();