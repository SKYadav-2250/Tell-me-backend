const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Otp = require('../models/Otp');
const nodemailer = require('nodemailer');

const OTP_LENGTH = 6;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const signupOtpAttempts = new Map();

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
const normalizeName = (name = '') => name.trim().replace(/\s+/g, ' ');
const normalizeAbout = (about = '') => about.trim();
const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);
const isStrongEnoughPassword = (password = '') => password.length >= 8;

const getOtpThrottleRemainingMs = (email) => {
  const lastAttemptAt = signupOtpAttempts.get(email);
  if (!lastAttemptAt) {
    return 0;
  }

  const elapsedMs = Date.now() - lastAttemptAt;
  return Math.max(0, OTP_RESEND_COOLDOWN_MS - elapsedMs);
};

const markOtpAttempt = (email) => {
  signupOtpAttempts.set(email, Date.now());
};

// POST /api/auth/signup
// Just sends the OTP. Does not create the user account yet.
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    console.log(`Signup attempt: ${normalizedEmail}`);

    if (!normalizedName || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
    }

    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Database connection is not ready. Please try again in a moment.' });
    }

    const remainingThrottleMs = getOtpThrottleRemainingMs(normalizedEmail);
    if (remainingThrottleMs > 0) {
      return res.status(429).json({
        message: `Please wait ${Math.ceil(remainingThrottleMs / 1000)} seconds before requesting another OTP.`,
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.deleteMany({ email: normalizedEmail });
    await Otp.create({ email: normalizedEmail, otp });
    markOtpAttempt(normalizedEmail);

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
        message: 'Failed to send OTP email. Configure EMAIL_USER and EMAIL_PASS in the backend .env file.',
      });
    }

    return res.status(200).json({
      message: 'OTP sent to email. Please verify to create your account.',
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error during signup' });
  }
};

// POST /api/auth/verify-otp
// Verifies OTP and finally creates the user account
const verifyOTP = async (req, res) => {
  try {
    const { name, email, password, about, otp } = req.body;
    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedAbout = normalizeAbout(about);
    const normalizedOtp = String(otp || '').trim();

    if (!normalizedName || !normalizedEmail || !password || !normalizedOtp) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
    }

    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalizedOtp)) {
      return res.status(400).json({ message: 'OTP must be a 6-digit code' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Database connection is not ready. Please try again in a moment.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const otpRecord = await Otp.findOne({ email: normalizedEmail, otp: normalizedOtp })
      .select('_id')
      .lean();
    if (!otpRecord) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let user;
    try {
      user = await User.create({
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
        about: normalizedAbout,
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      throw createError;
    }

    await Otp.deleteMany({ email: normalizedEmail });
    signupOtpAttempts.delete(normalizedEmail);

    const token = generateToken(user);

    return res.status(201).json({
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
    console.error('OTP verification error:', err);
    return res.status(500).json({ message: 'Server error during OTP verification' });
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

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Database connection is not ready. Please try again in a moment.' });
    }

    const user = await User.findOne({ email: normalizedEmail })
      .select('name email about passwordHash')
      .lean();
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    return res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        about: user.about,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

module.exports = { signup, login, verifyOTP };
