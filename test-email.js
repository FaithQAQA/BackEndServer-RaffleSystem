const { google } = require('googleapis');

const CLIENT_ID = '251445098515-k5cem4udl9o0hjelcjqbjhmfme7e4ndr.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = '1//04wIR5Wqblu_nCgYIARAAGAQSNwF-L9IrcUh9wHSHL6khuPeWEcf0HpLm12zKZxjcv0mQRhBYUJ4jgGUrjsSSyDdXBd9kzdusSmQ';
const FROM_EMAIL = 'voicenotify2@gmail.com';

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function sendGmail(to, subject, htmlContent) {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const rawMessage = Buffer.from(
      `From: Raffle System <${FROM_EMAIL}>\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${subject}\r\n\r\n` +
      `${htmlContent}`
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''); // URL-safe base64

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
    });

    console.log('✅ Gmail API email sent:', res.data.id);
  } catch (error) {
    console.error('❌ Gmail API Error:', error);
  }
}

// Test the email
sendGmail(
  'jalani.maynard@gmail.com', // Replace with your test email
  'Test Gmail API Email',
  '<p>Hello! This is a test email from the Gmail API.</p>'
);
