import crypto from 'node:crypto';
import { logger } from '../../../logger.js';
import {
  GEMINI_BASE_URL,
  GEMINI_OPERATIONAL_CONFIG,
  calculateEstimatedCost,
  getGeminiServerConfig,
} from './gemini.config.js';
import {
  AIConfigError,
  AIInvalidAuthError,
  AIInvalidModelError,
  AIProviderError,
  AIQuotaExceededError,
  AIRateLimitExceededError,
  AITimeoutError,
  AIValidationError,
} from './gemini.errors.js';
import type { GeminiRequestOptions, GeminiResponse } from './gemini.types.js';

interface RawCandidateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
      role?: string;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export class GeminiApiClient {
  private static instance: GeminiApiClient;
  // In-flight request deduplication cache to prevent duplicate outbound calls
  private readonly inFlightRequests = new Map<string, Promise<GeminiResponse<any>>>();

  public static getInstance(): GeminiApiClient {
    if (!GeminiApiClient.instance) {
      GeminiApiClient.instance = new GeminiApiClient();
    }
    return GeminiApiClient.instance;
  }

  /**
   * Generates a unique key for deduplicating identical in-flight requests.
   */
  private generateRequestKey(options: GeminiRequestOptions, model: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${options.action}:${options.systemInstruction || ''}:${options.prompt}`)
      .digest('hex');
    return `${options.tenantId}:${model}:${hash}`;
  }

  /**
   * Dispatches generateContent request to Google Gemini v1beta API with in-flight deduplication
   * and bounded, intelligent retry logic.
   */
  public async executeGenerateContent<T = string>(
    options: GeminiRequestOptions
  ): Promise<GeminiResponse<T>> {
    const serverConfig = getGeminiServerConfig();

    if (!serverConfig.isConfigured || !serverConfig.apiKey) {
      throw new AIConfigError(
        'Gemini AI intelligence service is not configured. Please supply a valid GEMINI_API_KEY in server environment.'
      );
    }

    const model = serverConfig.model;
    const requestKey = this.generateRequestKey(options, model);

    // In-flight deduplication: return the active pending promise if an identical call is currently executing
    const existingInFlight = this.inFlightRequests.get(requestKey);
    if (existingInFlight) {
      logger.info(
        `[GeminiClient] Deduplicating in-flight Gemini request for tenant: ${options.tenantId}, action: ${options.action}`
      );
      return existingInFlight as Promise<GeminiResponse<T>>;
    }

    const executionPromise = this.executeWithRetry<T>(options, serverConfig.apiKey, model);
    this.inFlightRequests.set(requestKey, executionPromise);

    try {
      return await executionPromise;
    } finally {
      this.inFlightRequests.delete(requestKey);
    }
  }

  private async executeWithRetry<T>(
    options: GeminiRequestOptions,
    apiKey: string,
    model: string
  ): Promise<GeminiResponse<T>> {
    const startTime = Date.now();
    const isJson = options.responseMimeType === 'application/json';
    const temperature = options.temperature ?? 0.15;
    const maxOutputTokens = options.maxTokens ?? 2048;
    const timeoutMs = options.timeoutMs ?? GEMINI_OPERATIONAL_CONFIG.defaultTimeoutMs;

    const requestBody: Record<string, any> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: options.prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
        ...(isJson ? { responseMimeType: 'application/json' } : {}),
      },
    };

    if (options.systemInstruction) {
      requestBody.system_instruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
    let lastError: Error | null = null;
    const maxRetries = GEMINI_OPERATIONAL_CONFIG.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const rawErrorText = await response.text().catch(() => '');
          const status = response.status;
          const classifiedError = this.classifyHttpError(status, rawErrorText, model);

          // DO NOT RETRY non-retryable errors (429 Quota Exhausted, 401, 403, 404, etc.)
          if (!classifiedError.isRetryable || attempt >= maxRetries) {
            throw classifiedError;
          }

          // Retryable error: Compute bounded backoff with jitter
          const backoff = Math.min(
            GEMINI_OPERATIONAL_CONFIG.maxBackoffMs,
            GEMINI_OPERATIONAL_CONFIG.baseBackoffMs * Math.pow(2, attempt) +
              Math.floor(Math.random() * 500)
          );

          logger.warn(
            `[GeminiClient] Transient provider failure (Status ${status}). Retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})...`
          );
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }

        const data: RawCandidateResponse = await response.json();
        const latencyMs = Date.now() - startTime;

        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content?.parts?.[0]?.text) {
          throw new AIValidationError(
            'Gemini API returned an empty response or candidate was blocked.'
          );
        }

        const rawText = candidate.content.parts[0].text.trim();
        const promptTokens =
          data.usageMetadata?.promptTokenCount || Math.ceil(options.prompt.length / 4);
        const completionTokens =
          data.usageMetadata?.candidatesTokenCount || Math.ceil(rawText.length / 4);
        const totalTokens = data.usageMetadata?.totalTokenCount || promptTokens + completionTokens;
        const estimatedCost = calculateEstimatedCost(model, promptTokens, completionTokens);

        let parsedContent: any = rawText;

        if (isJson) {
          parsedContent = this.cleanAndParseJson(rawText);
        }

        return {
          success: true,
          content: parsedContent as T,
          model,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost,
          },
          latencyMs,
        };
      } catch (err: any) {
        clearTimeout(timer);

        if (err.name === 'AbortError') {
          throw new AITimeoutError(timeoutMs);
        }

        if (err instanceof AIProviderError) {
          if (!err.isRetryable || attempt >= maxRetries) {
            throw err;
          }
          lastError = err;
          const backoff = GEMINI_OPERATIONAL_CONFIG.baseBackoffMs * (attempt + 1);
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }

        lastError = err;
        if (attempt >= maxRetries) {
          break;
        }
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      }
    }

    throw lastError || new AIProviderError('Gemini API communication failed.', 500);
  }

  /**
   * Classifies HTTP error responses from Google Gemini API according to exact provider signals.
   */
  private classifyHttpError(status: number, errorBody: string, model: string): AIProviderError {
    const lower = (errorBody || '').toLowerCase();

    // 1. Quota Exhaustion (RESOURCE_EXHAUSTED) - Terminal 429
    if (
      status === 429 &&
      (lower.includes('resource_exhausted') ||
        lower.includes('quota exceeded') ||
        lower.includes('quota') ||
        lower.includes('billing'))
    ) {
      return new AIQuotaExceededError(
        'Google Gemini quota exhausted for this API project. Please check quota limits and billing status in Google AI Studio or Google Cloud Console.'
      );
    }

    // 2. Transient 429 (Per-minute rate limit) - Retryable
    if (status === 429) {
      return new AIRateLimitExceededError(
        'Gemini request rate limit reached. Please wait a few seconds.'
      );
    }

    // 3. Authentication & API Key Errors
    if (
      status === 400 &&
      (lower.includes('api_key_invalid') ||
        lower.includes('invalid api key') ||
        lower.includes('api key not valid'))
    ) {
      return new AIInvalidAuthError('Provided GEMINI_API_KEY is invalid.');
    }

    if (status === 401 || status === 403) {
      return new AIInvalidAuthError(
        'Gemini API unauthorized or permission denied. Please verify your GEMINI_API_KEY.'
      );
    }

    // 4. Model Not Found
    if (status === 404) {
      return new AIInvalidModelError(model);
    }

    // 5. Transient Google Server Errors (500, 502, 503, 504) - Retryable
    if (status >= 500 && status <= 504) {
      return new AIProviderError(
        `Google Gemini provider server error (${status}).`,
        503,
        'PROVIDER_UNAVAILABLE',
        true,
        status
      );
    }

    return new AIProviderError(
      `Gemini API error (Status ${status}): ${errorBody.slice(0, 200)}`,
      status >= 400 && status < 500 ? status : 500,
      'PROVIDER_ERROR',
      false,
      status
    );
  }

  /**
   * Sanitizes markdown backticks and parses JSON safely.
   */
  private cleanAndParseJson(raw: string): any {
    let clean = raw.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    try {
      return JSON.parse(clean.trim());
    } catch {
      logger.error('[GeminiClient] JSON parse failure on response:', {
        rawSnippet: clean.slice(0, 300),
      });
      throw new AIValidationError('Gemini returned an invalid JSON response structure.');
    }
  }
}

export const geminiApiClient = GeminiApiClient.getInstance();
