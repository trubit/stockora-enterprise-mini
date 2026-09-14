import type { Request, Response } from 'express';
import { ForecastingService } from '../services/forecasting.service.js';
import { ReplenishmentService } from '../services/replenishment.service.js';
import { SupplierIntelligenceService } from '../services/supplier-intelligence.service.js';
import { InventoryOptimizationService } from '../services/inventory-optimization.service.js';
import { InventoryCopilotService } from '../services/inventory-copilot.service.js';
import { InventoryAIService } from '../services/ai/inventoryAI.service.js';
import { logger } from '../logger.js';

export class InventoryIntelligenceController {
  /**
   * GET /api/v1/inventory-intelligence/dashboard
   */
  public static async getDashboardData(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const aiOverview = await InventoryAIService.getAIInventoryHealthOverview(tenantId);
      const stockoutRisks = await InventoryOptimizationService.scanStockoutRisks();
      const { overstock, deadStock } =
        await InventoryOptimizationService.getOverstockAndDeadStock();
      const recommendations = await ReplenishmentService.getRecommendations('RECOMMENDED', 10);
      const supplierScores = await SupplierIntelligenceService.getSupplierScores();

      const kpis = {
        totalStockoutRisks:
          stockoutRisks.length || aiOverview.criticalStockoutCount + aiOverview.lowStockCount,
        criticalRisks:
          stockoutRisks.filter((r) => r.riskLevel === 'CRITICAL').length ||
          aiOverview.criticalStockoutCount,
        pendingReordersCount: recommendations.length,
        overstockItemsCount: overstock.length || aiOverview.deadStockCount,
        deadStockItemsCount: deadStock.length,
        totalInventoryValuation: aiOverview.totalInventoryValuation,
        avgSupplierScore:
          supplierScores.length > 0
            ? Math.round(
                supplierScores.reduce((acc, s) => acc + s.overallScore, 0) / supplierScores.length
              )
            : 88,
      };

      res.status(200).json({
        success: true,
        data: {
          kpis,
          aiStrategicDirectives: aiOverview.aiStrategicDirectives,
          stockoutRisks: stockoutRisks.slice(0, 10),
          recommendations,
          supplierScores: supplierScores.slice(0, 5),
          overstock: overstock.slice(0, 5),
          deadStock: deadStock.slice(0, 5),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Inventory Controller] Dashboard error: ${msg}`);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/v1/inventory-intelligence/forecast
   */
  public static async generateForecast(req: Request, res: Response) {
    try {
      const { productId, period, method, historicalDays } = req.body;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'productId is required' });
      }

      const forecast = await ForecastingService.generateProductForecast({
        productId,
        period,
        method,
        historicalDays,
      });

      res.status(200).json({ success: true, data: forecast });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Inventory Controller] Forecast error: ${msg}`);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/v1/inventory-intelligence/forecasts
   */
  public static async getForecasts(req: Request, res: Response) {
    try {
      const { productId } = req.query;
      const forecasts = await ForecastingService.getForecasts(productId as string | undefined);
      res.status(200).json({ success: true, data: forecasts });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/v1/inventory-intelligence/replenish
   */
  public static async calculateReplenishment(req: Request, res: Response) {
    try {
      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'productId is required' });
      }

      const rec = await ReplenishmentService.calculateReplenishment({ productId });
      res.status(200).json({ success: true, data: rec });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/v1/inventory-intelligence/reorders
   */
  public static async getReorders(req: Request, res: Response) {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const recommendations = await ReplenishmentService.getRecommendations(status);
      res.status(200).json({ success: true, data: recommendations });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/v1/inventory-intelligence/reorders/:id/override
   */
  public static async overrideReorder(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { overrideQuantity, reason } = req.body;
      const userId = (req as any).user?.id || '000000000000000000000000';

      const updated = await ReplenishmentService.overrideRecommendation(
        id,
        Number(overrideQuantity),
        reason,
        userId
      );

      res.status(200).json({ success: true, data: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/v1/inventory-intelligence/suppliers
   */
  public static async getSupplierScores(req: Request, res: Response) {
    try {
      const scores = await SupplierIntelligenceService.getSupplierScores();
      res.status(200).json({ success: true, data: scores });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/v1/inventory-intelligence/suppliers/evaluate
   */
  public static async evaluateSuppliers(req: Request, res: Response) {
    try {
      const results = await SupplierIntelligenceService.evaluateAllSuppliers();
      res.status(200).json({ success: true, data: results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/v1/inventory-intelligence/optimization
   */
  public static async getOptimization(req: Request, res: Response) {
    try {
      const risks = await InventoryOptimizationService.scanStockoutRisks();
      const { overstock, deadStock } =
        await InventoryOptimizationService.getOverstockAndDeadStock();
      const transfers = await InventoryOptimizationService.generateTransferRecommendations();

      res.status(200).json({
        success: true,
        data: {
          stockoutRisks: risks,
          overstock,
          deadStock,
          transferRecommendations: transfers,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/v1/inventory-intelligence/copilot/query
   */
  public static async copilotQuery(req: Request, res: Response) {
    try {
      const { sessionId, prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ success: false, message: 'prompt is required' });
      }

      const activeSession = sessionId || 'default-inventory-session';
      const answer = await InventoryCopilotService.queryInventoryCopilot(activeSession, prompt);

      res.status(200).json({ success: true, data: { answer, sessionId: activeSession } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }
}
