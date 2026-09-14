import express from 'express';
import { createServer } from 'http';
import path from 'path';
import cluster from 'cluster';
import os from 'os';
import { config } from '../config/environment.js';
import { logger } from './logger.js';
import { securityMiddleware } from './middleware/security.js';
import { DBConnectionManager } from './database/connection.js';
import { SocketManager } from './sockets/manager.js';
import { QueueManager } from './queue/bullmq.js';
import { apiRouter } from './routes/api.js';
import { notFoundHandler, errorHandler } from './errors/handlers.js';
import { telemetryMiddleware } from './middleware/telemetry.middleware.js';
import {
  seedRolesIfEmpty,
  seedProductsIfEmpty,
  seedDefaultsIfEmpty,
  seedUsersIfEmpty,
} from './database/seeder.js';
import { initializeBackgroundWorkers } from './queue/jobs.worker.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO lifecycle manager (must be done before routes)
const socketManager = SocketManager.getInstance();
socketManager.initialize(httpServer);

// ── Security Middleware ─────────────────────────────────────────────────────
// Includes: Helmet, CORS, rate-limiting, compression, cookie-parser
// NOTE: compression() is applied ONCE here inside securityMiddleware.
// Do NOT add it again below.
app.use(securityMiddleware);

// ── Body Parsers with Size Limits ───────────────────────────────────────────
// Limits prevent DoS attacks via oversized request payloads.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static Assets ───────────────────────────────────────────────────────────
// Serve uploaded files from configured runtime storage directory.
// NOTE: Express.static serves with long-lived cache headers in production.
const runtimeUploadsDir = path.resolve(process.cwd(), config.uploadDir || 'uploads');
app.use(
  '/uploads',
  express.static(runtimeUploadsDir, {
    maxAge: config.isProduction ? '7d' : 0,
    etag: true,
  })
);
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'public', 'uploads'), {
    maxAge: config.isProduction ? '7d' : 0,
    etag: true,
  })
);
app.use(
  express.static(path.join(process.cwd(), 'public'), {
    maxAge: config.isProduction ? '1d' : 0,
    etag: true,
  })
);

// ── HTTP Request Logging & Telemetry ────────────────────────────────────────
app.use((req, _res, next) => {
  logger.http(`${req.method} ${req.url} - IP: ${req.ip} (PID: ${process.pid})`);
  next();
});
app.use(telemetryMiddleware);

// ── Versioned API Routes ─────────────────────────────────────────────────────
// Mount under both /api/v1 and /api for maximum compatibility across client endpoints.
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// ── Production Frontend Serving ─────────────────────────────────────────────
if (config.isProduction) {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath, { maxAge: '1d', etag: true }));

  // SPA catch-all — serve index.html for any non-API route
  app.get('*', (req, res) => {
    // Don't catch API routes
    if (req.path.startsWith('/api/')) {
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Development: graceful welcome message at API root
  app.get('/', (_req, res) => {
    res.json({
      message:
        'Stockora Enterprise Mini API (Development Mode). Navigate to the frontend dev server port.',
      endpoints: {
        health: '/api/v1/health',
        products: '/api/v1/products',
        transactions: '/api/v1/transactions',
        auth: '/api/v1/auth',
      },
    });
  });
}

// ── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
const dbManager = DBConnectionManager.getInstance();

let isShuttingDown = false;

async function gracefulShutdown(signal: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(
    `Shutdown signal [${signal}] received on worker [${process.pid}]. Initiating graceful shutdown...`
  );

  // Stop accepting new HTTP connections first
  await new Promise<void>((resolve) => {
    if (httpServer.listening) {
      httpServer.close(() => {
        logger.info(`HTTP server closed on worker [${process.pid}].`);
        resolve();
      });
    } else {
      resolve();
    }
  });

  // Close queues, sockets, and database connections
  await Promise.allSettled([QueueManager.getInstance().shutdown(), socketManager.shutdown()]);

  await dbManager.disconnect();

  try {
    const { redisManager } = await import('./database/redis.js');
    await redisManager.disconnect();
  } catch (err) {
    logger.error('Error disconnecting Redis client during shutdown:', err);
  }

  logger.warn(`Stockora Worker [${process.pid}] stopped cleanly.`);
  process.exit(exitCode);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));

// Catch unhandled promise rejections — log and trigger graceful shutdown safely
process.on('unhandledRejection', (reason: any) => {
  const reasonStr = String(reason?.message || reason);
  if (reasonStr.includes('Connection is closed')) {
    logger.warn(`[Redis Connection Alert] ${reasonStr}`);
    return;
  }

  if (isShuttingDown) return;

  logger.error(`[FATAL] Unhandled Promise Rejection: ${reasonStr}`);
  gracefulShutdown('unhandledRejection', 1).catch(() => process.exit(1));
});

// Catch uncaught exceptions — log and trigger graceful shutdown safely
process.on('uncaughtException', (err) => {
  if (isShuttingDown) return;
  logger.error(`[FATAL] Uncaught Exception: ${err.message}`, err);
  gracefulShutdown('uncaughtException', 1).catch(() => process.exit(1));
});

// ── Server Start ──────────────────────────────────────────────────────────────
async function startServer(): Promise<void> {
  try {
    // 1. Connect to MongoDB first and ensure database is ready
    await dbManager.connect();
    if (isShuttingDown) return;

    // 2. Run database seeders (idempotent — safe to call every startup)
    if (!isShuttingDown) await seedRolesIfEmpty();
    if (!config.isProduction && !isShuttingDown) {
      await seedProductsIfEmpty();
      await seedDefaultsIfEmpty();
      await seedUsersIfEmpty();
    }

    // 3. Start background job workers and register event handlers
    if (!isShuttingDown) {
      await initializeBackgroundWorkers();
      const { FinancialTransactionService } =
        await import('./services/financialTransaction.service.js');
      FinancialTransactionService.registerEventHandlers();
    }

    // 4. Bind HTTP server with explicit error handling for port collisions (EADDRINUSE)
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(
            `[Server Bootstrap] Port ${config.port} is already in use by another process. Please terminate the process holding port ${config.port} or choose another port.`
          );
        } else {
          logger.error('[Server Bootstrap] Failed to start HTTP server:', err);
        }
        reject(err);
      });

      httpServer.listen(config.port, '0.0.0.0', () => {
        logger.info(
          `Stockora Worker (PID: ${process.pid}) running in [${config.env}] mode on http://0.0.0.0:${config.port}`
        );
        resolve();
      });
    });
  } catch (err) {
    if (isShuttingDown) return;
    logger.error('[Server Bootstrap Error]:', err);
    await gracefulShutdown('bootstrapError', 1);
  }
}

// ── Cluster Mode (Production) ─────────────────────────────────────────────────
// Spawns one worker per CPU core for maximum horizontal throughput.
if (config.isProduction) {
  if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;
    logger.info(
      `Stockora Primary Process (PID: ${process.pid}). Forking ${numCPUs} cluster workers...`
    );

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(
        `Worker ${worker.process.pid} exited (code: ${code}, signal: ${signal}). Spawning replacement...`
      );
      cluster.fork();
    });
  } else {
    startServer();
  }
} else {
  // Single-process for developer debugging ease in development/test
  startServer();
}
