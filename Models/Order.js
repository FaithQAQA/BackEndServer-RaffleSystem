const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    raffleId: { type: mongoose.Schema.Types.ObjectId, ref: "Raffle", required: true },
    ticketsBought: { type: Number, required: true },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    status: { type: String, default: "completed" },
    paymentId: { type: String, required: true },
    receiptSent: { type: Boolean, default: false },
    receiptSentAt: { type: Date },
    receiptError: { type: String }
  },
  { timestamps: true }
);

// Instance method to get formatted order info
orderSchema.methods.getOrderSummary = function() {
  return {
    orderId: this._id,
    userId: this.userId,
    raffleId: this.raffleId,
    ticketsBought: this.ticketsBought,
    totalAmount: this.amount,
    baseAmount: this.baseAmount,
    taxAmount: this.taxAmount,
    taxRate: ((this.taxAmount / this.baseAmount) * 100).toFixed(2) + '%',
    status: this.status,
    createdAt: this.createdAt,
    isReceiptSent: this.receiptSent
  };
};

// Instance method to mark receipt as sent
orderSchema.methods.markReceiptSent = function() {
  this.receiptSent = true;
  this.receiptSentAt = new Date();
  this.receiptError = undefined;
  return this.save();
};

// Instance method to mark receipt failed
orderSchema.methods.markReceiptFailed = function(error) {
  this.receiptError = error;
  return this.save();
};

module.exports = mongoose.model("Order", orderSchema);