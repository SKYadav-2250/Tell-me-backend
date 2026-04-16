const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { initializeSocket } = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://tellme-frontend.vercel.app',
];

const allowedOrigins = Array.from(
  new Set(
    [process.env.CORS_ORIGINS, process.env.CLIENT_URL]
      .filter(Boolean)
      .flatMap((value) => value.split(','))
      .map((origin) => origin.trim())
      .filter(Boolean)
      .concat(DEFAULT_ALLOWED_ORIGINS),
  ),
);

const validateOrigin = (origin, callback) => {
  // Allow requests without an Origin header, such as health checks and server-to-server calls.
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked: ${origin}`));
};

const corsOptions = {
  origin: validateOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
};

const io = new Server(server, {
  cors: {
    origin: validateOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  },
});

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  const databaseStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const database = databaseStates[mongoose.connection.readyState] || 'unknown';

  res.json({
    status: database === 'connected' ? 'OK' : 'DEGRADED',
    message: 'TellMe server is running',
    database,
  });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

mongoose.connection.on('connected', () => {
  console.log('MongoDB connection ready');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

// Socket.IO
initializeSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`TellMe server running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
