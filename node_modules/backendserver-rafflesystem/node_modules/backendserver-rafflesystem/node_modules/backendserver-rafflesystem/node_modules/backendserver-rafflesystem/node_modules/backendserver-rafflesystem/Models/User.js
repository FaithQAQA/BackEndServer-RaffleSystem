// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0 }, // Track failed attempts
  emailVerified: { type: Boolean, default: false }, // New field
  verificationToken: { type: String }, // New field
  isLocked: { type: Boolean, default: false }, // Lock account after too many failed attempts
  lockUntil: { type: Date }, // Time until account is locked
  tickets: [
    {
      raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle' },
      raffleItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'RaffleItem' },
      ticketsBought: { type: Number, default: 0 },
    },
  ],
});

// Compare password
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Hash password before saving


module.exports = mongoose.model('User', userSchema);