import { AppError } from '../../../errors/AppError.js';

export class AIProviderError extends AppError {
  public readonly isRetryable: boolean;
  public readonly providerStatus?: number;
  public readonly errorCategory: string;

  constructor(
    message: string,
    statusCode = 503,
    errorCategory = 'AI_PROVIDER_ERROR',
    isRetryable = false,
    providerStatus?: number
  ) {
    super(message, statusCode, 'AI_SERVICE_ERROR', undefined, true);
    this.name = 'AIProviderError';
    this.isRetryable = isRetryable;
    this.providerStatus = providerStatus;
    this.errorCategory = errorCategory;
  }
}

/**
 * 429 Quota Exceeded (RESOURCE_EXHAUSTED).
 * Must NEVER be retried automatically.
 */
export class AIQuotaExceededError extends AIProviderError {
  constructor(
    message = 'Google Gemini project quota exhausted. Please check Google Cloud / AI Studio quota and billing settings.'
  ) {
    super(message, 429, 'QUOTA_EXCEEDED', false, 429);
    this.name = 'AIQuotaExceededError';
  }
}

/**
 * Transient per-minute rate limit (retryable with backoff).
 */
export class AIRateLimitExceededError extends AIProviderError {
  public readonly retryAfterMs?: number;

  constructor(
    message = 'Gemini rate limit reached. Please wait a moment before trying again.',
    retryAfterMs?: number
  ) {
    super(message, 429, 'RATE_LIMITED', true, 429);
    this.name = 'AIRateLimitExceededError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Invalid or unauthorized API key (non-retryable).
 */
export class AIInvalidAuthError extends AIProviderError {
  constructor(
    message = 'Invalid or unauthorized Gemini API key. Please check your GEMINI_API_KEY.'
  ) {
    super(message, 401, 'INVALID_AUTHENTICATION', false, 401);
    this.name = 'AIInvalidAuthError';
  }
}

/**
 * Invalid Gemini model specified (non-retryable).
 */
export class AIInvalidModelError extends AIProviderError {
  constructor(modelName: string) {
    super(
      `Specified Gemini model '${modelName}' is invalid or not available in your project.`,
      400,
      'INVALID_MODEL',
      false,
      404
    );
    this.name = 'AIInvalidModelError';
  }
}

/**
 * Request execution timeout (non-retryable).
 */
export class AITimeoutError extends AIProviderError {
  constructor(timeoutMs: number) {
    super(`Gemini API request timed out after ${timeoutMs}ms.`, 504, 'TIMEOUT', false, 504);
    this.name = 'AITimeoutError';
  }
}

/**
 * Configuration missing or disabled (non-retryable).
 */
export class AIConfigError extends AIProviderError {
  constructor(message = 'Gemini AI service is not configured or disabled on this server.') {
    super(message, 503, 'INVALID_CONFIGURATION', false);
    this.name = 'AIConfigError';
  }
}

/**
 * Malformed JSON or schema validation failure from provider (non-retryable).
 */
export class AIValidationError extends AIProviderError {
  constructor(message = 'Gemini response failed structure validation.') {
    super(message, 502, 'RESPONSE_MALFORMED', false, 502);
    this.name = 'AIValidationError';
  }
}
