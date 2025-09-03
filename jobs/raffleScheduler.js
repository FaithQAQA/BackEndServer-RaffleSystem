const cron = require('node-cron');
const Raffle = require('../Models/Raffle');
const mongoose = require('mongoose');

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

  const winnerIndex = Math.floor(Math.random() * ticketPool.length);
  const winner = ticketPool[winnerIndex];

  raffle.winner = winner;
  raffle.status = "completed";
  await raffle.save();

  console.log(`✅ Winner selected for raffle "${raffle.title}": ${winner}`);
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
