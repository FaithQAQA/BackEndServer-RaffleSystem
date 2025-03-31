const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0 },
  emailVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  isLocked: { type: Boolean, default: false },
  lockUntil: { type: Date },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
});

// Compare password
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
