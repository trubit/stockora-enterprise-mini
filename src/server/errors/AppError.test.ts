import { describe, it, expect } from 'vitest';
import { AppError, ValidationError, NotFoundError } from './AppError.js';

describe('AppError Framework', () => {
  it('should instantiate AppError with correct properties', () => {
    const error = new AppError('Server crash', 500, 'INTERNAL_ERROR', undefined, false);
    expect(error.message).toBe('Server crash');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(false);
  });

  it('should configure fields in ValidationError', () => {
    const valErr = new ValidationError('Bad request', ['sku: required']);
    expect(valErr.statusCode).toBe(400);
    expect(valErr.code).toBe('VALIDATION_ERROR');
    expect(valErr.details).toEqual(['sku: required']);
    expect(valErr.isOperational).toBe(true);
  });

  it('should configure fields in NotFoundError', () => {
    const nfErr = new NotFoundError();
    expect(nfErr.statusCode).toBe(404);
    expect(nfErr.code).toBe('NOT_FOUND');
    expect(nfErr.isOperational).toBe(true);
  });
});
