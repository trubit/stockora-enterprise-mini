/**
 * Stockora Enterprise — Gemini AI Type Definitions
 */

export interface GeminiRequestOptions {
  tenantId: string;
  userId?: string;
  action: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: 'text/plain' | 'application/json';
  timeoutMs?: number;
}

export interface GeminiUsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface GeminiResponse<T = string> {
  success: boolean;
  content: T;
  model: string;
  usage: GeminiUsageMetadata;
  latencyMs: number;
  cached?: boolean;
}

export interface ModelPricingTier {
  inputPerMillion: number;
  outputPerMillion: number;
}

export type AIRequestStatus =
  'SUCCESS' | 'FAILED' | 'RATE_LIMITED' | 'QUOTA_EXCEEDED' | 'TIMEOUT' | 'INVALID_CONFIGURATION';
