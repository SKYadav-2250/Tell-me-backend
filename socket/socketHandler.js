const jwt = require('jsonwebtoken');
const {
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
  addMessage,
  getRoomMessages,
} = require('./roomManager');

const MAX_ROOM_ID_LENGTH = 120;
const MAX_TEXT_MESSAGE_LENGTH = 4000;
const MAX_IMAGE_DATA_LENGTH = 7 * 1024 * 1024;

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const normalizeRoomId = (roomId) => {
  if (typeof roomId !== 'string') {
    return '';
  }

  return roomId.trim();
};

const isValidRoomId = (roomId) =>
  Boolean(roomId) &&
  roomId.length <= MAX_ROOM_ID_LENGTH &&
  /^[A-Za-z0-9_-]+$/.test(roomId);

const leaveCurrentRoom = (io, socket, socketRoomMap) => {
  const existingRoomId = socketRoomMap.get(socket.id);
  if (!existingRoomId) {
    return null;
  }

  socket.leave(existingRoomId);
  const user = removeUserFromRoom(existingRoomId, socket.id);
  socketRoomMap.delete(socket.id);

  if (user) {
    const roomUsers = getRoomUsers(existingRoomId);
    io.to(existingRoomId).emit('user-left', {
      user,
      roomUsers,
      message: `${user.name} left the room`,
      timestamp: new Date().toISOString(),
    });
  }

  return { existingRoomId, user };
};

const initializeSocket = (io) => {
  const socketRoomMap = new Map();

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, token } = {}) => {
      const decoded = verifyToken(token);
      if (!decoded) {
        socket.emit('error', { message: 'Authentication failed. Please log in again.' });
        return;
      }

      const normalizedRoomId = normalizeRoomId(roomId);
      if (!isValidRoomId(normalizedRoomId)) {
        socket.emit('error', { message: 'Invalid room ID.' });
        return;
      }

      const existingRoomId = socketRoomMap.get(socket.id);
      if (existingRoomId === normalizedRoomId) {
        socket.emit('message-history', getRoomMessages(normalizedRoomId));
        socket.emit('user-joined', {
          user: {
            userId: decoded.id,
            name: decoded.name,
            email: decoded.email,
            socketId: socket.id,
          },
          roomUsers: getRoomUsers(normalizedRoomId),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      leaveCurrentRoom(io, socket, socketRoomMap);

      const userInfo = {
        userId: decoded.id,
        name: decoded.name,
        email: decoded.email,
        socketId: socket.id,
      };

      socket.join(normalizedRoomId);
      socketRoomMap.set(socket.id, normalizedRoomId);
      addUserToRoom(normalizedRoomId, socket.id, userInfo);

      socket.emit('message-history', getRoomMessages(normalizedRoomId));

      const roomUsers = getRoomUsers(normalizedRoomId);
      io.to(normalizedRoomId).emit('user-joined', {
        user: userInfo,
        roomUsers,
        message: `${decoded.name} joined the room`,
        timestamp: new Date().toISOString(),
      });

      console.log(`${decoded.name} joined room: ${normalizedRoomId}`);
    });

    socket.on('send-message', ({ roomId, encryptedText, type, imageData, token, timestamp } = {}) => {
      const decoded = verifyToken(token);
      if (!decoded) {
        socket.emit('error', { message: 'Authentication failed' });
        return;
      }

      const normalizedRoomId = normalizeRoomId(roomId);
      if (!isValidRoomId(normalizedRoomId)) {
        socket.emit('error', { message: 'Invalid room ID.' });
        return;
      }

      if (socketRoomMap.get(socket.id) !== normalizedRoomId) {
        socket.emit('error', { message: 'Join the room before sending messages.' });
        return;
      }

      const messageType = type === 'image' ? 'image' : 'text';
      const safeTimestamp = timestamp || new Date().toISOString();

      if (messageType === 'text') {
        if (typeof encryptedText !== 'string' || !encryptedText.trim()) {
          socket.emit('error', { message: 'Message text is required.' });
          return;
        }

        if (encryptedText.length > MAX_TEXT_MESSAGE_LENGTH) {
          socket.emit('error', { message: 'Message is too long.' });
          return;
        }
      }

      if (messageType === 'image') {
        if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
          socket.emit('error', { message: 'Invalid image payload.' });
          return;
        }

        if (imageData.length > MAX_IMAGE_DATA_LENGTH) {
          socket.emit('error', { message: 'Image payload is too large.' });
          return;
        }
      }

      const message = {
        id: `${decoded.id}-${safeTimestamp}`,
        senderId: decoded.id,
        senderName: decoded.name,
        encryptedText: messageType === 'text' ? encryptedText : null,
        imageData: messageType === 'image' ? imageData : null,
        type: messageType,
        timestamp: safeTimestamp,
      };

      addMessage(normalizedRoomId, message);
      io.to(normalizedRoomId).emit('receive-message', message);
    });

    socket.on('disconnect', () => {
      const leaveState = leaveCurrentRoom(io, socket, socketRoomMap);
      if (leaveState?.existingRoomId && leaveState.user) {
        console.log(`${leaveState.user.name} left room: ${leaveState.existingRoomId}`);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { initializeSocket };
