import winston from 'winston';
import path from 'path';
import { config } from '../config/environment.js';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

/** Structured JSON format for file transports — machine-parseable by log collectors */
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/** Human-readable colored format for console output */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    (info) =>
      `[${info.timestamp}] [${info.level}]: ${info.message}${info.stack ? `\n${info.stack}` : ''}`
  )
);

const transports: winston.transport[] = [];

// ── Console Transport (always enabled) ────────────────────────────────────────
transports.push(
  new winston.transports.Console({
    level: config.logLevel,
    format: consoleFormat,
  })
);

// ── File Transports (production only) ─────────────────────────────────────────
// Uses rotating log files to prevent unbounded disk usage.
if (config.isProduction) {
  const logsDir = path.join(process.cwd(), 'logs');

  // Error log — only error level
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // Rotate at 10MB
      maxFiles: 5, // Keep at most 5 rotated error logs
      tailable: true,
    })
  );

  // Combined log — all levels up to configured LOG_LEVEL
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: config.logLevel,
      format: jsonFormat,
      maxsize: 20 * 1024 * 1024, // Rotate at 20MB
      maxFiles: 7, // Keep at most 7 rotated combined logs
      tailable: true,
    })
  );

  // HTTP access log — http level only (separated for access log analysis)
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      level: 'http',
      format: jsonFormat,
      maxsize: 50 * 1024 * 1024, // Rotate at 50MB (HTTP logs are high-volume)
      maxFiles: 3, // Keep at most 3 rotated HTTP logs
      tailable: true,
    })
  );
}

export const logger = winston.createLogger({
  level: config.logLevel,
  levels,
  format: jsonFormat,
  transports,
  // Do NOT exit on uncaught exceptions from logger itself
  exitOnError: false,
});
