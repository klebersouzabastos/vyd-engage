import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
// @ts-ignore — `cookie` é dep transitiva (via cookie-parser); CI sem @types/cookie
import cookie from 'cookie';
import { logger } from '../utils/logger.js';

let io: Server | null = null;

interface AuthPayload {
  userId: string;
  tenantId: string;
  email: string;
}

/**
 * Initialize Socket.IO server attached to the HTTP server.
 */
export function initSocketIO(httpServer: HttpServer, corsOrigins: string[]): Server {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware — verify JWT from cookie or handshake auth
  io.use((socket, next) => {
    // Try auth token from handshake, then from cookie
    let token = socket.handshake.auth?.token;
    if (!token) {
      const cookies = cookie.parse(socket.handshake.headers?.cookie || '');
      token = cookies.accessToken;
    }
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      (socket as any).userId = decoded.userId;
      (socket as any).tenantId = decoded.tenantId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const tenantId = (socket as any).tenantId;

    // Join user-specific and tenant-specific rooms
    socket.join(`user:${userId}`);
    socket.join(`tenant:${tenantId}`);

    logger.info('WebSocket connected', { userId, tenantId, socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('WebSocket disconnected', { userId, socketId: socket.id });
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance (for emitting events from services).
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Emit a notification to a specific user.
 */
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit an event to all users in a tenant.
 */
export function emitToTenant(tenantId: string, event: string, data: any) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit(event, data);
}
