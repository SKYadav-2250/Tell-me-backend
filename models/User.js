const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email'],
    },
    passwordHash: {
      type: String,
      required: true,
    },
    about: {
      type: String,
      trim: true,
      maxlength: 200,
      default: 'Hey there! I am using TellMe.',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
