// server.js
const app = require('./app');
const dotenv = require('dotenv');
require('./jobs/raffleScheduler');  // This will start the cron job

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to take messages ✅");
  }
});
