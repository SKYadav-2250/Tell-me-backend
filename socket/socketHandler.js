const jwt = require('jsonwebtoken');
const {
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
  addMessage,
  getRoomMessages,
} = require('./roomManager');

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const initializeSocket = (io) => {
  // Map to track which rooms a socket is in: socketId -> roomId
  const socketRoomMap = new Map();

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    /**
     * join-room
     * payload: { roomId, token }
     */
    socket.on('join-room', ({ roomId, token }) => {
      const decoded = verifyToken(token);
      if (!decoded) {
        socket.emit('error', { message: 'Authentication failed. Please log in again.' });
        return;
      }

      const userInfo = {
        userId: decoded.id,
        name: decoded.name,
        email: decoded.email,
        socketId: socket.id,
      };

      socket.join(roomId);
      socketRoomMap.set(socket.id, roomId);
      addUserToRoom(roomId, socket.id, userInfo);

      // Send existing messages to the newly joined user
      const history = getRoomMessages(roomId);
      socket.emit('message-history', history);

      // Get updated users list
      const roomUsers = getRoomUsers(roomId);

      // Notify everyone in room that a new user joined
      io.to(roomId).emit('user-joined', {
        user: userInfo,
        roomUsers,
        message: `${decoded.name} joined the room`,
        timestamp: new Date().toISOString(),
      });

      console.log(`👤 ${decoded.name} joined room: ${roomId}`);
    });

    /**
     * send-message
     * payload: { roomId, encryptedText, type, imageData, token, timestamp }
     * type: 'text' | 'image'
     */
    socket.on('send-message', ({ roomId, encryptedText, type, imageData, token, timestamp }) => {
      const decoded = verifyToken(token);
      if (!decoded) {
        socket.emit('error', { message: 'Authentication failed' });
        return;
      }

      const message = {
        id: `${Date.now()}-${socket.id}`,
        senderId: decoded.id,
        senderName: decoded.name,
        encryptedText: type === 'text' ? encryptedText : null,
        imageData: type === 'image' ? imageData : null,
        type: type || 'text',
        timestamp: timestamp || new Date().toISOString(),
      };

      addMessage(roomId, message);

      // Broadcast to all in room (including sender for confirmation)
      io.to(roomId).emit('receive-message', message);
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      const roomId = socketRoomMap.get(socket.id);
      if (roomId) {
        const user = removeUserFromRoom(roomId, socket.id);
        socketRoomMap.delete(socket.id);

        if (user) {
          const roomUsers = getRoomUsers(roomId);
          io.to(roomId).emit('user-left', {
            user,
            roomUsers,
            message: `${user.name} left the room`,
            timestamp: new Date().toISOString(),
          });
          console.log(`👋 ${user.name} left room: ${roomId}`);
        }
      }
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { initializeSocket };
