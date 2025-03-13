const mongoose = require("mongoose");
const raffleItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  boxNumber: { type: Number, required: true },
  imageURL: { type: String, required: true },
  raffleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Raffle",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("RaffleItem", raffleItemSchema);
