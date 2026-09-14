import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { aiIntelligenceService } from '../services/ai/aiIntelligence.service.js';
import { geminiService } from '../services/ai/gemini.service.js';
import { ValidationError, AuthorizationError } from '../errors/AppError.js';
import { logger } from '../logger.js';

export class AIController {
  /**
   * Helper to ensure tenantId is present and authorized
   */
  private static getTenantId(req: AuthenticatedRequest): string {
    const tenantId = req.tenantId || req.user?.tenantId?.toString();
    if (!tenantId) {
      throw new AuthorizationError('Tenant context is missing or unauthorized.');
    }
    return tenantId;
  }

  /**
   * GET /api/v1/ai/status
   * Returns current AI service operational status and configured model
   */
  public static async getStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const isConfigured = geminiService.isConfigured();
      const model = geminiService.getModelName();
      res.json({
        success: true,
        data: {
          configured: isConfigured,
          model,
          provider: 'Google Gemini',
          mode: isConfigured ? 'PRODUCTION' : 'UNCONFIGURED',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/ai/assistant
   * Grounded interactive assistant query
   */
  public static async askAssistant(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = AIController.getTenantId(req);
      const { message, history } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        throw new ValidationError('A non-empty question or prompt is required.');
      }

      if (message.length > 1000) {
        throw new ValidationError('Message exceeds maximum length of 1,000 characters.');
      }

      const result = await aiIntelligenceService.askAssistant(
        tenantId,
        message,
        req.user?.id,
        Array.isArray(history) ? history : undefined
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ai/inventory-intelligence
   * Holistic inventory analysis, valuation, and stockout radar
   */
  public static async getInventoryIntelligence(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = AIController.getTenantId(req);
      const analysis = await aiIntelligenceService.analyzeInventory(tenantId, req.user?.id);

      res.json({
        success: true,
        data: analysis,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ai/reorders
   * AI-assisted reorder recommendations grounded in velocity and lead time
   */
  public static async getReorderRecommendations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = AIController.getTenantId(req);
      const recommendations = await aiIntelligenceService.generateReorderRecommendations(
        tenantId,
        req.user?.id
      );

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ai/forecast
   * Statistical & AI demand forecasting
   */
  public static async getDemandForecast(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = AIController.getTenantId(req);
      const days = req.query.days
        ? Math.min(90, Math.max(7, parseInt(String(req.query.days), 10)))
        : 30;

      const forecast = await aiIntelligenceService.forecastDemand(tenantId, req.user?.id, days);

      res.json({
        success: true,
        data: forecast,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ai/sales-intelligence
   * Sales trend and product performance interpretation
   */
  public static async getSalesIntelligence(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = AIController.getTenantId(req);
      const days = req.query.days
        ? Math.min(90, Math.max(7, parseInt(String(req.query.days), 10)))
        : 30;

      const salesAnalysis = await aiIntelligenceService.analyzeSales(tenantId, req.user?.id, days);

      res.json({
        success: true,
        data: salesAnalysis,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ai/anomalies
   * Neutral audit of unusual inventory movements and adjustments
   */
  public static async getAnomalies(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = AIController.getTenantId(req);
      const anomalies = await aiIntelligenceService.detectAnomalies(tenantId, req.user?.id);

      res.json({
        success: true,
        data: anomalies,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ai/summary
   * Executive briefing (DAILY, WEEKLY, MONTHLY)
   */
  public static async getBusinessSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = AIController.getTenantId(req);
      const timeframeRaw = ((req.query.timeframe as string) || 'DAILY').toUpperCase();
      const timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' =
        timeframeRaw === 'WEEKLY' || timeframeRaw === 'MONTHLY' ? timeframeRaw : 'DAILY';

      const summary = await aiIntelligenceService.generateBusinessSummary(
        tenantId,
        timeframe,
        req.user?.id
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }
}
