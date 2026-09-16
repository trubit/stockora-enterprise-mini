import type { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from '../database/redis.js';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';
import jwt from 'jsonwebtoken';

interface JwtTokenPayload {
  id: string;
  roleName: string;
  tenantId?: string;
}

/**
 * Validates a Socket.IO origin against the configured CORS allowlist.
 * Mirrors the HTTP CORS logic in security.ts for consistency.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Allow server-to-server / no-origin requests

  if (config.isDevelopment) {
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^https?:\/\/.*\.local(:\d+)?$/.test(origin)
    ) {
      return true;
    }
  }

  return origin === config.corsOrigin;
}

export class SocketManager {
  private static instance: SocketManager | null = null;
  private io: SocketServer | null = null;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  private subClient: any = null;

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public initialize(server: HttpServer): SocketServer {
    if (this.io) return this.io;

    this.io = new SocketServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            // Block all other origins — no open-door fallback
            callback(new Error(`Socket.IO CORS: Origin [${origin}] is not allowed.`));
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      // Limit the maximum size of incoming socket messages (prevent DoS)
      maxHttpBufferSize: 1e6, // 1 MB
    });

    try {
      const pubClient = redis;
      this.subClient = redis.duplicate();
      this.subClient.on('error', (err: any) => {
        if (!err?.message?.includes('Connection is closed')) {
          logger.warn(`[Socket.IO Redis subClient] ${err.message}`);
        }
      });
      this.io.adapter(createAdapter(pubClient, this.subClient, { key: 'mini:socket.io' }));
      logger.info('Socket.IO Redis Pub/Sub adapter registered.');
    } catch (err) {
      logger.error('Failed to configure Socket.IO Redis adapter:', err);
    }

    // JWT authentication middleware on WebSocket handshake
    this.io.use((socket: Socket, next) => {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization?.replace('Bearer ', '') as string | undefined);

      if (!token) {
        // Unauthenticated connection allowed — public events only
        return next();
      }

      try {
        const decoded = jwt.verify(token, config.jwtSecret, {
          issuer: 'stockora-enterprise-mini',
          audience: 'stockora-enterprise-mini',
        }) as JwtTokenPayload;
        socket.data.userId = decoded.id;
        socket.data.roleName = decoded.roleName;
        socket.data.tenantId = decoded.tenantId;
      } catch {
        // Invalid token — log and proceed as unauthenticated rather than rejecting
        // This allows graceful degradation for expired tokens on reconnect
        logger.warn(`[Socket] Invalid JWT on handshake from socket ${socket.id}`);
      }
      next();
    });

    this.setupListeners();
    logger.info('Socket.IO server initialized successfully.');
    return this.io;
  }

  private setupListeners(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.info(
        `Client connected: ${socket.id} (user=${socket.data.userId ?? 'anon'}, role=${socket.data.roleName ?? 'none'})`
      );

      // Join personal user room for targeted notifications
      if (socket.data.userId) {
        socket.join(`user:${socket.data.userId}`);
      }

      // Join role-based broadcast room
      if (socket.data.roleName) {
        socket.join(`role:${socket.data.roleName}`);
      }

      // Join tenant-scoped room and tenant-role room for multi-tenant isolation
      if (socket.data.tenantId) {
        socket.join(`tenant:${socket.data.tenantId}`);
        if (socket.data.roleName) {
          socket.join(`tenant:${socket.data.tenantId}:role:${socket.data.roleName}`);
        }
      }

      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} (reason: ${reason})`);
      });

      socket.on('error', (err) => {
        logger.error(`[Socket] Error on socket ${socket.id}:`, err);
      });
    });
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  public emitGlobal(event: string, payload: any): void {
    if (!this.io) {
      if (process.env.NODE_ENV !== 'test') {
        logger.warn('Cannot emit event: Socket.IO is not initialized.');
      }
      return;
    }
    this.io.emit(event, payload);
  }

  /**
   * Emit to a named room (e.g. 'user:<id>', 'role:<roleName>', 'tenant:<id>').
   */
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  public emitToRoom(room: string, event: string, payload: any): void {
    if (!this.io) {
      if (process.env.NODE_ENV !== 'test') {
        logger.warn('Cannot emit to room: Socket.IO is not initialized.');
      }
      return;
    }
    this.io.to(room).emit(event, payload);
  }

  public async shutdown(): Promise<void> {
    if (this.subClient) {
      try {
        if (this.subClient.status === 'ready' || this.subClient.status === 'connect') {
          await this.subClient.quit();
        } else {
          this.subClient.disconnect();
        }
        logger.info('Socket.IO subscriber Redis client closed.');
      } catch (err: any) {
        try {
          this.subClient.disconnect();
        } catch {
          // ignore
        }
        if (!err?.message?.includes('Connection is closed')) {
          logger.error('Error closing Socket.IO subscriber Redis client:', err);
        }
      }
    }

    if (!this.io) return;
    await new Promise<void>((resolve) => {
      this.io!.close(() => {
        logger.info('Socket.IO server closed.');
        resolve();
      });
    });
  }
}
