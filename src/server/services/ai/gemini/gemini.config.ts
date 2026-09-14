import { config } from '../../../../config/environment.js';
import type { ModelPricingTier } from './gemini.types.js';
import { AIInvalidModelError } from './gemini.errors.js';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Standard officially supported Gemini production models
 */
export const SUPPORTED_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-2.0-pro-exp-02-05',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
] as const;

/**
 * Official token pricing reference per 1,000,000 tokens (USD)
 */
export const MODEL_PRICING: Record<string, ModelPricingTier> = {
  'gemini-2.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.0 },
  'gemini-flash-latest': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'gemini-pro-latest': { inputPerMillion: 1.25, outputPerMillion: 5.0 },
  'gemini-2.5-flash-lite': { inputPerMillion: 0.0375, outputPerMillion: 0.15 },
  'gemini-2.0-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  'gemini-2.0-flash-lite-preview-02-05': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'gemini-2.0-pro-exp-02-05': { inputPerMillion: 3.5, outputPerMillion: 10.5 },
  'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'gemini-1.5-flash-8b': { inputPerMillion: 0.0375, outputPerMillion: 0.15 },
  'gemini-1.5-pro': { inputPerMillion: 3.5, outputPerMillion: 10.5 },
};

export const DEFAULT_PRICING: ModelPricingTier = {
  inputPerMillion: 0.1,
  outputPerMillion: 0.4,
};

export const GEMINI_OPERATIONAL_CONFIG = {
  defaultTimeoutMs: 30000, // 30s timeout
  maxRetries: 2, // Only for transient errors
  baseBackoffMs: 1200,
  maxBackoffMs: 6000,
  maxInFlightPerTenant: 5,
};

/**
 * Validates the configured Gemini model name.
 * Throws AIInvalidModelError if model does not match recognized Gemini patterns.
 */
export function validateGeminiModel(modelName: string): string {
  const trimmed = (modelName || '').trim();
  if (!trimmed) {
    throw new AIInvalidModelError('Model name cannot be empty');
  }

  // Exact match or standard gemini pattern
  const isSupported =
    SUPPORTED_GEMINI_MODELS.includes(trimmed as any) || /^gemini-[a-zA-Z0-9.-]+$/i.test(trimmed);

  if (!isSupported) {
    throw new AIInvalidModelError(trimmed);
  }

  return trimmed;
}

/**
 * Calculates deterministic estimated cost based on token counts and model pricing.
 */
export function calculateEstimatedCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(8));
}

export function getGeminiServerConfig() {
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    config.geminiApiKey ||
    process.env.AI_SERVICE_API_KEY ||
    ''
  ).trim();
  const rawModel = (
    process.env.GEMINI_MODEL ||
    config.geminiModel ||
    process.env.AI_MODEL_NAME ||
    'gemini-2.5-flash'
  ).trim();
  const enabled = config.geminiEnabled !== false;

  const model = validateGeminiModel(rawModel);

  return {
    apiKey: apiKey || null,
    model,
    enabled,
    isConfigured: Boolean(apiKey && apiKey.length > 0 && enabled),
  };
}
