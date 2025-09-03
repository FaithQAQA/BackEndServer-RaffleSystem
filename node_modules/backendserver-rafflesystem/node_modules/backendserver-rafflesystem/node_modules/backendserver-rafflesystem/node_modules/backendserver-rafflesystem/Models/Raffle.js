const mongoose = require('mongoose');

const raffleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  raised: { type: Number, default: 0 },
  totalTicketsSold: { type: Number, default: 0 }, // Start at 0 instead of 10
  raffleItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RaffleItem' }],
  participants: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      ticketsBought: { type: Number, default: 0 },
      enteredAt: { type: Date, default: Date.now },
    },
  ],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, 
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Raffle', raffleSchema);
