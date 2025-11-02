const { google } = require('googleapis');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.CLIENT_ID = '251445098515-k5cem4udl9o0hjelcjqbjhmfme7e4ndr.apps.googleusercontent.com';
    this.CLIENT_SECRET = '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';
    this.REDIRECT_URI = 'https://developers.google.com/oauthplayground';
    this.REFRESH_TOKEN = '1//04wIR5Wqblu_nCgYIARAAGAQSNwF-L9IrcUh9wHSHL6khuPeWEcf0HpLm12zKZxjcv0mQRhBYUJ4jgGUrjsSSyDdXBd9kzdusSmQ';
    this.FROM_EMAIL = 'voicenotify2@gmail.com';
    
    this.oAuth2Client = new google.auth.OAuth2(
      this.CLIENT_ID, 
      this.CLIENT_SECRET, 
      this.REDIRECT_URI
    );
    this.oAuth2Client.setCredentials({ refresh_token: this.REFRESH_TOKEN });
  }

  async sendEmail(to, subject, htmlContent, fromName = 'Raffle System') {
    try {
      const accessToken = await this.oAuth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: this.FROM_EMAIL,
          clientId: this.CLIENT_ID,
          clientSecret: this.CLIENT_SECRET,
          refreshToken: this.REFRESH_TOKEN,
          accessToken: accessToken.token,
        },
        // Force Nodemailer to use HTTPS API, not SMTP
        // This is key for Render
        host: 'gmail.googleapis.com',
        port: 443,
        secure: true,
      });

      const mailOptions = {
        from: `${fromName} <${this.FROM_EMAIL}>`,
        to,
        subject,
        html: htmlContent,
        text: htmlContent.replace(/<[^>]*>/g, ''),
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Gmail API Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Gmail API Error sending email:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailService;
