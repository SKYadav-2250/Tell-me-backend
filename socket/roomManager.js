/**
 * In-memory room store.
 * rooms = Map<roomId, { messages: [], users: Map<socketId, userInfo> }>
 */

const rooms = new Map();

const getOrCreateRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      messages: [],
      users: new Map(), // socketId -> { userId, name, email }
    });
  }
  return rooms.get(roomId);
};

const addUserToRoom = (roomId, socketId, userInfo) => {
  const room = getOrCreateRoom(roomId);
  room.users.set(socketId, userInfo);
};

const removeUserFromRoom = (roomId, socketId) => {
  if (!rooms.has(roomId)) return null;
  const room = rooms.get(roomId);
  const user = room.users.get(socketId);
  room.users.delete(socketId);

  // Clean up empty rooms
  if (room.users.size === 0) {
    rooms.delete(roomId);
  }

  return user;
};

const getRoomUsers = (roomId) => {
  if (!rooms.has(roomId)) return [];
  const room = rooms.get(roomId);
  return Array.from(room.users.values());
};

const addMessage = (roomId, message) => {
  const room = getOrCreateRoom(roomId);
  room.messages.push(message);
  // Keep only last 100 messages in memory
  if (room.messages.length > 100) {
    room.messages.shift();
  }
};

const getRoomMessages = (roomId) => {
  if (!rooms.has(roomId)) return [];
  return rooms.get(roomId).messages;
};

const getUserBySocket = (roomId, socketId) => {
  if (!rooms.has(roomId)) return null;
  return rooms.get(roomId).users.get(socketId) || null;
};

module.exports = {
  getOrCreateRoom,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
  addMessage,
  getRoomMessages,
  getUserBySocket,
};
