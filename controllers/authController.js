const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
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
const signup = async (req, res) => {
  try {
    const { name, email, password, about } = req.body;
    console.log(` ${name}  ${email}`);
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Database connection is not ready. Please try again in a moment.' });
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user = await User.findOne({ email: normalizedEmail });
    
    if (user) {
      if (user.isVerified) {
        return res.status(409).json({ message: 'Email already in use' });
      } else {
        // User exists but unverified, update OTP and resend
        user.name = name;
        user.passwordHash = passwordHash;
        user.about = about || user.about;
        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();
      }
    } else {
      user = await User.create({ name, email: normalizedEmail, passwordHash, about, otp, otpExpires, isVerified: false });
    }

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: normalizedEmail,
        subject: 'TellMe - Verify Your Email',
        text: `Your OTP for TellMe signup is ${otp}. It expires in 10 minutes.`,
      });
    } catch (mailErr) {
      console.error('Email error:', mailErr);
      return res.status(500).json({ message: 'Failed to send OTP email. Please ensure email credentials are correct.' });
    }

    res.status(201).json({
      message: 'OTP sent to email. Please verify.',
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup' });
  }
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User already verified' });
    }

    if (user.otp !== otp) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    if (new Date() > user.otpExpires) {
      return res.status(401).json({ message: 'OTP expired' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = generateToken(user);

    res.json({
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

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Email not verified. Please sign up to verify.' });
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
