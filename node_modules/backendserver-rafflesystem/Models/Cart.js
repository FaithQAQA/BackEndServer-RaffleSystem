const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
      quantity: { type: Number, required: true },
      totalCost: { type: Number, required: true }  
    }
  ]
});

module.exports = mongoose.model('Cart', cartSchema);
