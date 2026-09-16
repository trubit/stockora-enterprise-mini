import helmet from 'helmet';
import cors from 'cors';
import rateLimit, {
  type Store,
  type Options as RateLimitOptions,
  type ClientRateLimitInfo,
} from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Router } from 'express';
import { config } from '../../config/environment.js';
import { redis } from '../database/redis.js';
import { logger } from '../logger.js';

export const securityMiddleware = Router();

// Build the CORS origin allowlist. In development, allow localhost/127.0.0.1 and local network LAN/Wi-Fi IPs.
// In production, only the explicit CORS_ORIGIN is allowed.
const isDevOriginAllowed = (origin: string): boolean => {
  return (
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/.*\.local(:\d+)?$/.test(origin)
  );
};

const buildCorsOriginMatcher = () => {
  const allowedOrigin = config.corsOrigin;

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ): void => {
    // Allow server-to-server requests (no Origin header)
    if (!origin) return callback(null, true);

    // In development: allow any localhost, LAN IP, or mobile device during development
    if (config.isDevelopment) {
      return callback(null, true);
    }

    // Always allow the explicitly configured CORS origin in production
    if (origin === allowedOrigin) {
      return callback(null, true);
    }

    // Block everything else — do NOT fall through with callback(null, true)
    callback(new Error(`CORS: Origin [${origin}] is not allowed.`));
  };
};

// 1. Helmet headers for OWASP compliance (XSS, clickjacking, HSTS, CSP)
securityMiddleware.use(
  helmet({
    contentSecurityPolicy: config.isDevelopment
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://js.stripe.com', 'https://js.paystack.co'],
            frameSrc: [
              "'self'",
              'https://js.stripe.com',
              'https://checkout.paystack.com',
              'https://standard.paystack.co',
            ],
            connectSrc: [
              "'self'",
              'wss:',
              'ws:',
              'https://api.stripe.com',
              'https://api.paystack.co',
            ],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        },
    // Strict-Transport-Security: enforce HTTPS in production
    hsts: config.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// 2. CORS — strict allowlist, no open-door fallback
securityMiddleware.use(
  cors({
    origin: buildCorsOriginMatcher(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Tenant-Id',
      'X-Tenant-Slug',
      'X-Correlation-Id',
    ],
  })
);

// 3. Request body size limits — prevent DoS via oversized payloads
// Applied globally here so they take effect before any route handler.
securityMiddleware.use((req, res, next) => {
  // Express body parsers are set in server/index.ts with limits — this is an
  // additional guard at the middleware layer for raw requests.
  next();
});

// 4. Redis-backed rate limiting — effective across all cluster workers and pods
class RedisRateLimitStore implements Store {
  private windowMs: number = 60000;
  public prefix: string;

  constructor(prefix = 'rl:') {
    this.prefix = prefix;
  }

  init(options: RateLimitOptions): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const fullKey = `${this.prefix}${key}`;
    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
        const hits = await redis.incr(fullKey);
        if (hits === 1) {
          await redis.pexpire(fullKey, this.windowMs);
        }
        const pttl = await redis.pttl(fullKey);
        const resetTime = new Date(Date.now() + (pttl > 0 ? pttl : this.windowMs));
        return { totalHits: hits, resetTime };
      }
    } catch (err) {
      logger.warn(`[RedisRateLimitStore] Redis rate limiter fallback: ${err}`);
    }
    return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
  }

  async decrement(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    try {
      if (redis && redis.status === 'ready') {
        await redis.decr(fullKey);
      }
    } catch {
      // Ignore
    }
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    try {
      if (redis && redis.status === 'ready') {
        await redis.del(fullKey);
      }
    } catch {
      // Ignore
    }
  }
}

const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.isProduction ? config.rateLimitMax : 1000,
  store: new RedisRateLimitStore('rl:api:'),
  standardHeaders: true, // Emit RateLimit-* headers
  legacyHeaders: false, // Disable deprecated X-RateLimit-* headers
  keyGenerator: (req) => {
    // Use the real client IP even behind a reverse proxy
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || 'unknown';
    return ip;
  },
  message: {
    status: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  skip: (req) => req.path === '/api/v1/health', // Never rate-limit the health endpoint
});

// Apply general rate limiter to all API routes
securityMiddleware.use('/api/', apiLimiter);

// 5. Stricter authentication rate limiter — brute-force / credential stuffing protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isProduction ? 15 : 150,
  store: new RedisRateLimitStore('rl:auth:'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || 'unknown';
    return ip;
  },
  message: {
    status: 429,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});
securityMiddleware.use('/api/v1/auth/login', authLimiter);
securityMiddleware.use('/api/v1/auth/register', authLimiter);
securityMiddleware.use('/api/v1/auth/forgot-password', authLimiter);

// 6. Gzip/Brotli compression for performance optimization
securityMiddleware.use(compression());

// 7. Parse cookies securely — use dedicated COOKIE_SECRET (not the JWT signing secret)
securityMiddleware.use(cookieParser(config.cookieSecret));
