import { logger } from '../../../logger.js';
import { geminiApiClient } from './gemini.client.js';
import { getGeminiServerConfig } from './gemini.config.js';
import {
  AIConfigError,
  AIProviderError,
  AIQuotaExceededError,
  AIRateLimitExceededError,
  AITimeoutError,
} from './gemini.errors.js';
import type { GeminiRequestOptions, GeminiResponse } from './gemini.types.js';
import { aiUsageService } from '../usage/ai-usage.service.js';

export class GeminiService {
  private static instance: GeminiService;

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  public isConfigured(): boolean {
    const config = getGeminiServerConfig();
    return config.isConfigured;
  }

  public getModelName(): string {
    const config = getGeminiServerConfig();
    return config.model;
  }

  /**
   * Main entrypoint for generating AI content using the configured Google Gemini API.
   * Enforces prompt injection filtering, execution timeout, and audit usage logging.
   */
  public async generateContent<T = string>(
    options: GeminiRequestOptions
  ): Promise<GeminiResponse<T>> {
    const startTime = Date.now();
    const serverConfig = getGeminiServerConfig();

    if (!serverConfig.isConfigured) {
      const err = new AIConfigError(
        'Gemini AI intelligence service is not configured on this server. Please provide a valid GEMINI_API_KEY in server environment.'
      );
      await aiUsageService.logExecution({
        tenantId: options.tenantId,
        userId: options.userId,
        action: options.action,
        model: serverConfig.model,
        latencyMs: Date.now() - startTime,
        status: 'INVALID_CONFIGURATION',
        errorCategory: 'CONFIG_MISSING',
        errorMessage: err.message,
      });
      throw err;
    }

    try {
      const response = await geminiApiClient.executeGenerateContent<T>(options);
      const latencyMs = Date.now() - startTime;

      // Log successful execution
      await aiUsageService.logExecution({
        tenantId: options.tenantId,
        userId: options.userId,
        action: options.action,
        model: response.model,
        prompt: options.prompt,
        response:
          typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content),
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        estimatedCost: response.usage.estimatedCost,
        latencyMs,
        status: 'SUCCESS',
      });

      return response;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      let status:
        'RATE_LIMITED' | 'QUOTA_EXCEEDED' | 'TIMEOUT' | 'INVALID_CONFIGURATION' | 'FAILED' =
        'FAILED';

      if (err instanceof AIQuotaExceededError) {
        status = 'QUOTA_EXCEEDED';
      } else if (err instanceof AIRateLimitExceededError) {
        status = 'RATE_LIMITED';
      } else if (err instanceof AITimeoutError) {
        status = 'TIMEOUT';
      } else if (err instanceof AIConfigError) {
        status = 'INVALID_CONFIGURATION';
      }

      await aiUsageService.logExecution({
        tenantId: options.tenantId,
        userId: options.userId,
        action: options.action,
        model: serverConfig.model,
        prompt: options.prompt,
        latencyMs,
        status,
        errorCategory: err.name || 'AI_ERROR',
        errorMessage: err.message || 'Unknown error occurred during Gemini inference',
      });

      logger.error(`[GeminiService] Failed execution (${status}) for action ${options.action}:`, {
        error: err.message,
        category: err.errorCategory,
        statusCode: err.statusCode,
      });

      throw err;
    }
  }
}

export const geminiService = GeminiService.getInstance();
