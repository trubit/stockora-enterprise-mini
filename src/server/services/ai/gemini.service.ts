/**
 * Re-export authoritative GeminiService from modular gemini package
 */
export { GeminiService, geminiService } from './gemini/gemini.service.js';
export type {
  GeminiRequestOptions,
  GeminiResponse,
  GeminiUsageMetadata,
  AIRequestStatus,
} from './gemini/gemini.types.js';
export {
  AIProviderError,
  AIQuotaExceededError,
  AIRateLimitExceededError,
  AIInvalidAuthError,
  AIInvalidModelError,
  AITimeoutError,
  AIConfigError,
  AIValidationError,
} from './gemini/gemini.errors.js';
export {
  SUPPORTED_GEMINI_MODELS,
  validateGeminiModel,
  calculateEstimatedCost,
  getGeminiServerConfig,
} from './gemini/gemini.config.js';
