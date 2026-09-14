import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError.js';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const error = new AppError(
    `Cannot find ${req.method} ${req.originalUrl} on this server`,
    404,
    'NOT_FOUND'
  );
  next(error);
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  let error = err;

  // Transform Zod schema validation errors
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    error = new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
  }

  // Transform MongoDB Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => (e as { message: string }).message);
    error = new AppError('Database validation failed', 400, 'VALIDATION_ERROR', details);
  }

  if (err.name === 'CastError') {
    error = new AppError(`Invalid database identifier: ${err.value}`, 400, 'VALIDATION_ERROR');
  }

  // Transform MongoDB E11000 duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : 'value';
    error = new AppError(
      `Unique constraint violated: ${field} [${value}] already exists.`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const status = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';

  // Hide internal server crash details from clients in production
  const message =
    error.isOperational || !config.isProduction
      ? error.message
      : 'An unexpected server error occurred.';

  const details = error.details;

  if (status >= 500) {
    logger.error(`[500 Server Error] ${err.message || err} | Stack: ${err.stack}`);
  } else if (process.env.NODE_ENV !== 'test') {
    logger.warn(
      `[Client Warning] ${status} ${code}: ${error.message} - Details: ${JSON.stringify(details || [])}`
    );
  }

  res.status(status).json({
    error: {
      message,
      status,
      code,
      ...(details ? { details } : {}),
      ...(!config.isProduction && status >= 500 ? { stack: err.stack } : {}),
    },
  });
}
