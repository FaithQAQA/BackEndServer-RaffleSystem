const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    raffleId: { type: mongoose.Schema.Types.ObjectId, ref: "Raffle", required: true },
    ticketsBought: { type: Number, required: true },
    amount: { type: Number, required: true }, // money made
    status: { type: String, default: "completed" }, // could also be "pending", "cancelled", etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
