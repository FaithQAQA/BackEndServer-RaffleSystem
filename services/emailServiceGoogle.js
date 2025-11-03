const { google } = require('googleapis');
const sgMail = require('@sendgrid/mail');

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

module.exports = EmailService;
