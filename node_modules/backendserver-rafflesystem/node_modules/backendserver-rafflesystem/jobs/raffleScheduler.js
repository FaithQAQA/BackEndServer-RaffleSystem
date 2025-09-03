const cron = require('node-cron');
const Raffle = require('../Models/Raffle');
const mongoose = require('mongoose');
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // set in .env
    pass: process.env.EMAIL_PASS, // app password for Gmail
  },
});

async function sendWinnerEmail(user, raffle) {
  try {
    await transporter.sendMail({
      from: `"Raffle App" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `🎉 Congratulations! You won the raffle: ${raffle.title}`,
      text: `Hi ${user.username},\n\nYou won the raffle "${raffle.title}"! 🎊\n\nDescription: ${raffle.description}\n\nWe’ll contact you soon for prize details.\n\nThanks for playing!`,
    });

    console.log(`📩 Email sent to ${user.email} for raffle "${raffle.title}"`);
  } catch (err) {
    console.error("❌ Error sending email:", err);
  }
}

// This should call the same logic as your pickWinner method
const pickWinner = async (raffle) => {
  if (!raffle.participants || raffle.participants.length === 0) return;

  // Weighted random selection
  let ticketPool = [];
  raffle.participants.forEach(p => {
    for (let i = 0; i < p.ticketsBought; i++) {
      ticketPool.push(p.userId);
    }
  });

const winnerId = ticketPool[Math.floor(Math.random() * ticketPool.length)];

  // Fetch full winner user info
  const User = require("../Models/User");
  const winnerUser = await User.findById(winnerId);

  // Save winner to raffle
  raffle.winner = winnerUser._id;
  raffle.status = "completed";
  await raffle.save();

  console.log(`✅ Winner selected for raffle "${raffle.title}": ${winnerUser.email}`);

  // Send winner email
  await sendWinnerEmail(winnerUser, raffle);
};

// Run every minute (adjust timing as needed)
cron.schedule('* * * * *', async () => {
  console.log("🔍 Checking raffles...");

  try {
    // Find raffles that ended but are still active
    const rafflesToClose = await Raffle.find({
      endDate: { $lte: new Date() },
      status: "active"
    });

    for (let raffle of rafflesToClose) {
      await pickWinner(raffle);
    }
  } catch (err) {
    console.error("❌ Error in raffle scheduler:", err);
  }
});
module.exports = { sendWinnerEmail };