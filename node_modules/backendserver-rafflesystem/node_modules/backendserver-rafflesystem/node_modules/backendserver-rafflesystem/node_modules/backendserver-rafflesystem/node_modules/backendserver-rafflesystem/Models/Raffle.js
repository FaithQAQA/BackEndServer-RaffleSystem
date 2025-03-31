const mongoose = require('mongoose');

const raffleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  status: { type: String, enum: ['active', 'closed', 'completed'], default: 'active' },
  raised: { type: Number, default: 0 },
  totalTicketsSold: { type: Number, default: 10 }, // New field for easier ticket tracking
  raffleItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RaffleItem' }],
  participants: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      ticketsBought: { type: Number, default: 0 },
      enteredAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Raffle', raffleSchema);
