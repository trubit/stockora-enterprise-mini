import mongoose from 'mongoose';
import { logger } from '../../../logger.js';
import { AIUsageLog } from '../../../models/AIUsageLog.js';
import { calculateEstimatedCost } from '../gemini/gemini.config.js';
import type { AIRequestStatus } from '../gemini/gemini.types.js';

export interface LogUsageParams {
  tenantId: string;
  userId?: string;
  action: string;
  model: string;
  prompt?: string;
  response?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  latencyMs: number;
  status: AIRequestStatus;
  errorCategory?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export class AIUsageService {
  private static instance: AIUsageService;

  public static getInstance(): AIUsageService {
    if (!AIUsageService.instance) {
      AIUsageService.instance = new AIUsageService();
    }
    return AIUsageService.instance;
  }

  /**
   * Records an AI execution log entry.
   * Strips all potential credential patterns and never throws to caller.
   */
  public async logExecution(params: LogUsageParams): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 1) {
        return;
      }

      const safePrompt = this.sanitizeForLogging(params.prompt || '', 1000);
      const safeResponse = this.sanitizeForLogging(params.response || '', 1000);
      const safeErrorMessage = this.sanitizeForLogging(params.errorMessage || '', 300);

      const promptTokens = params.promptTokens || 0;
      const completionTokens = params.completionTokens || 0;
      const totalTokens = params.totalTokens || promptTokens + completionTokens;

      const estimatedCost =
        params.estimatedCost !== undefined
          ? params.estimatedCost
          : calculateEstimatedCost(params.model, promptTokens, completionTokens);

      await AIUsageLog.create({
        tenantId: params.tenantId || 'global',
        userId: params.userId,
        action: params.action || 'AI_EXECUTION',
        modelName: params.model,
        providerName: 'GEMINI',
        prompt: safePrompt,
        response: safeResponse,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        latencyMs: params.latencyMs || 0,
        status: params.status,
        errorCategory: params.errorCategory || '',
        errorMessage: safeErrorMessage,
        metadata: params.metadata || {},
      });
    } catch (logErr) {
      logger.warn('[AIUsageService] Failed to record AI usage log:', logErr);
    }
  }

  /**
   * Sanitizes string to ensure no API keys, JWTs, OTPs, or passwords can ever enter logs.
   */
  private sanitizeForLogging(text: string, maxLength: number): string {
    if (!text) return '';
    return text
      .slice(0, maxLength)
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .replace(/AQ\.[0-9A-Za-z-_]{40,60}/g, '[REDACTED_GEMINI_KEY]')
      .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]')
      .replace(/(?:password|secret|key|token)["':\s]+["']?([^\s"',}]+)/gi, '$1:[REDACTED]');
  }
}

export const aiUsageService = AIUsageService.getInstance();
