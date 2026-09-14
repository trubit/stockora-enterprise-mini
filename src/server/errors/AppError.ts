import type { ErrorCode } from '../../shared/errors.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: string[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details?: string[],
    isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: string[]) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed. Please log in.') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied. You lack the required permissions.') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found.') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: string[]) {
    super(message, 500, 'DATABASE_ERROR', details, false);
  }
}

export class PaymentGatewayError extends AppError {
  constructor(message: string, statusCode: number = 400, details?: string[]) {
    super(message, statusCode, 'PAYMENT_GATEWAY_ERROR', details);
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit or AI service quota reached. Please try again later.',
    statusCode: number = 429,
    details?: string[]
  ) {
    super(message, statusCode, 'RATE_LIMIT_EXCEEDED', details, true);
  }
}

export class AIServiceError extends AppError {
  constructor(
    message: string = 'AI service temporarily unavailable.',
    statusCode: number = 503,
    details?: string[]
  ) {
    super(message, statusCode, 'AI_SERVICE_ERROR', details, true);
  }
}
