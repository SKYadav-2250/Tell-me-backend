const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Otp = require('../models/Otp');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1y' }
  );
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const normalizeEmail = (email = '') => email.trim().toLowerCase();

// POST /api/auth/signup
// Just sends the OTP. Does not create the user account yet.
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log(`Signup Attempt: ${name}  ${email}`);
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Database connection is not ready. Please try again in a moment.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        return res.status(409).json({ message: 'Email already in use' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email
    await Otp.deleteMany({ email: normalizedEmail });
    
    // Create new OTP
    await Otp.create({ email: normalizedEmail, otp });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: normalizedEmail,
        subject: 'TellMe - Verify Your Email',
        text: `Your OTP for TellMe signup is ${otp}. It expires in 10 minutes.`,
      });
    } catch (mailErr) {
      console.error('Email error:', mailErr);
      return res.status(500).json({ 
        message: 'Failed to send OTP email. Note: You must configure real EMAIL_USER and EMAIL_PASS (App Password) in the backend .env file.' 
      });
    }

    res.status(200).json({
      message: 'OTP sent to email. Please verify to create your account.',
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup' });
  }
};

// POST /api/auth/verify-otp
// Verifies OTP and finally creates the user account
const verifyOTP = async (req, res) => {
  try {
    const { name, email, password, about, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !otp || !name || !password) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otpRecord = await Otp.findOne({ email: normalizedEmail, otp });
    if (!otpRecord) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await User.create({ 
        name, 
        email: normalizedEmail, 
        passwordHash, 
        about 
    });

    // Clean up OTP
    await Otp.deleteMany({ email: normalizedEmail });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Email verified and account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        about: user.about,
      },
    });
  } catch (err) {
    console.error('OTP Verification error:', err);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Database connection is not ready. Please try again in a moment.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        about: user.about,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
};

module.exports = { signup, login, verifyOTP };
