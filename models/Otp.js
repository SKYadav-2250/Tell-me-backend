const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // The document will be automatically deleted after 10 minutes
  },
});

otpSchema.index({ email: 1, otp: 1 });

module.exports = mongoose.model('Otp', otpSchema);
