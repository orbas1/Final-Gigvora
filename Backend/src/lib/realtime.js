const { Server } = require('socket.io');
const { verifyToken } = require('../utils/token');
const config = require('../config');

let io;
const userSockets = new Map();

const userRoom = (userId) => `user:${userId}`;
const conversationRoom = (conversationId) => `conversation:${conversationId}`;

const broadcastPresence = (userId, status) => {
  if (!io) return;
  io.emit('presence', {
    user_id: userId,
    status,
    timestamp: new Date().toISOString(),
  });
};

const registerSocket = (userId, socket) => {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);
  socket.join(userRoom(userId));
  broadcastPresence(userId, 'online');
};

const unregisterSocket = (userId, socketId) => {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (!sockets.size) {
    userSockets.delete(userId);
    broadcastPresence(userId, 'offline');
  }
};

const initRealtime = (httpServer, { origins } = {}) => {
  const corsOrigins = origins === '*' ? '*' : origins || config.http?.cors?.origins || '*';
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins === '*' ? '*' : corsOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token) {
        const header = socket.handshake.headers.authorization;
        if (header) {
          const [scheme, credentials] = header.split(' ');
          if (scheme && /^Bearer$/i.test(scheme) && credentials) {
            token = credentials;
          }
        }
      }
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = verifyToken(token);
      socket.user = { id: payload.sub, role: payload.role };
      return next();
    } catch (error) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    registerSocket(userId, socket);

    socket.on('join:conversation', (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationRoom(conversationId));
    });

    socket.on('leave:conversation', (conversationId) => {
      if (!conversationId) return;
      socket.leave(conversationRoom(conversationId));
    });

    socket.on('typing', (payload = {}) => {
      if (!payload.conversationId) return;
      socket.to(conversationRoom(payload.conversationId)).emit('typing', {
        conversation_id: payload.conversationId,
        user_id: userId,
        state: payload.state !== undefined ? payload.state : true,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      unregisterSocket(userId, socket.id);
    });
  });

  return io;
};

const getIo = () => io;

const emitToUsers = (userIds, event, payload) => {
  if (!io || !Array.isArray(userIds)) return;
  userIds.forEach((userId) => {
    io.to(userRoom(userId)).emit(event, payload);
  });
};

const emitToConversation = (conversationId, event, userIds, payload) => {
  if (!io) return;
  io.to(conversationRoom(conversationId)).emit(event, payload);
  if (Array.isArray(userIds)) {
    emitToUsers(userIds, event, payload);
  }
};

module.exports = {
  initRealtime,
  getIo,
  emitToUsers,
  emitToConversation,
};
