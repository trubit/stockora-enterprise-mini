import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  BusinessIntelligenceService,
  type DateFilterPeriod,
  type ComparisonType,
} from '../services/businessIntelligence.service.js';
import { DecisionIntelligenceService } from '../services/ai/decisionIntelligence.service.js';
import { BusinessAlertService } from '../services/businessAlert.service.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError } from '../errors/AppError.js';
import mongoose from 'mongoose';

export class AnalyticsController {
  private static parseFilters(req: AuthenticatedRequest) {
    const period = (req.query.period as DateFilterPeriod) || '30_DAYS';
    const comparison = (req.query.comparison as ComparisonType) || 'PREVIOUS_PERIOD';
    const branchId = req.query.branchId as string | undefined;
    const warehouseId = req.query.warehouseId as string | undefined;
    const customStart = req.query.startDate as string | undefined;
    const customEnd = req.query.endDate as string | undefined;
    const limit = Number(req.query.limit) || 10;
    const tenantId = req.tenantId || (req.user as any)?.tenantId || 'default';

    return { period, comparison, branchId, warehouseId, customStart, customEnd, limit, tenantId };
  }

  // 1. Executive Metrics
  public static async getExecutiveMetrics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { period, comparison, branchId, customStart, customEnd, tenantId } =
        AnalyticsController.parseFilters(req);

      const metrics = await BusinessIntelligenceService.getExecutiveMetrics(
        tenantId,
        branchId,
        period,
        comparison,
        customStart,
        customEnd
      );
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  }

  // 2. Sales Trends
  public static async getSalesTrend(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { period, branchId, tenantId } = AnalyticsController.parseFilters(req);
      const granularity = (req.query.granularity as any) || 'DAILY';

      const trend = await BusinessIntelligenceService.getSalesTrend(
        tenantId,
        branchId,
        period,
        granularity
      );
      res.json(trend);
    } catch (err) {
      next(err);
    }
  }

  // 3. Sales Channels
  public static async getSalesChannels(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { period, tenantId } = AnalyticsController.parseFilters(req);
      const channels = await BusinessIntelligenceService.getSalesChannels(tenantId, period);
      res.json(channels);
    } catch (err) {
      next(err);
    }
  }

  // 4. Branch Performance
  public static async getBranchPerformance(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { period, tenantId } = AnalyticsController.parseFilters(req);
      const branches = await BusinessIntelligenceService.getBranchPerformance(tenantId, period);
      res.json(branches);
    } catch (err) {
      next(err);
    }
  }

  // 5. Warehouse Logistics Analytics
  public static async getWarehouseAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const warehouses = await BusinessIntelligenceService.getWarehouseAnalytics(tenantId);
      res.json(warehouses);
    } catch (err) {
      next(err);
    }
  }

  // 6. Inventory Intelligence & Velocity
  public static async getInventoryIntelligence(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const inv = await BusinessIntelligenceService.getInventoryIntelligence(tenantId);
      res.json(inv);
    } catch (err) {
      next(err);
    }
  }

  // 7. Stockout Analytics
  public static async getStockoutAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const stockouts = await BusinessIntelligenceService.getStockoutAnalytics(tenantId);
      res.json(stockouts);
    } catch (err) {
      next(err);
    }
  }

  // 8. BCG Product Matrix
  public static async getProductBCGMatrix(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const matrix = await BusinessIntelligenceService.getProductBCGMatrix(tenantId);
      res.json(matrix);
    } catch (err) {
      next(err);
    }
  }

  // 9. Customer Cohorts
  public static async getCustomerCohorts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const cohorts = await BusinessIntelligenceService.getCustomerCohorts(tenantId);
      res.json(cohorts);
    } catch (err) {
      next(err);
    }
  }

  // 10. Supplier Scorecards
  public static async getSupplierScorecards(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const scorecards = await BusinessIntelligenceService.getSupplierScorecards(tenantId);
      res.json(scorecards);
    } catch (err) {
      next(err);
    }
  }

  // 11. Cash Register Variance
  public static async getCashRegisterAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const cash = await BusinessIntelligenceService.getCashRegisterAnalytics(tenantId);
      res.json(cash);
    } catch (err) {
      next(err);
    }
  }

  // 12. Business Health Score
  public static async getBusinessHealthScore(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const score = await BusinessIntelligenceService.calculateBusinessHealthScore(tenantId);
      res.json(score);
    } catch (err) {
      next(err);
    }
  }

  // 13. Executive Summary
  public static async getExecutiveSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { period, tenantId } = AnalyticsController.parseFilters(req);
      const summary = await BusinessIntelligenceService.getExecutiveSummaryReport(tenantId, period);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }

  // 14. Daily AI Briefing
  public static async getDailyBriefing(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const briefing = await DecisionIntelligenceService.generateDailyBriefing(tenantId);
      res.json(briefing);
    } catch (err) {
      next(err);
    }
  }

  // 15. Active Business Alerts
  public static async getBusinessAlerts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const alerts = await BusinessAlertService.scanAndGenerateAlerts(tenantId);
      res.json(alerts);
    } catch (err) {
      next(err);
    }
  }

  public static async acknowledgeAlert(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const alertId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const success = BusinessAlertService.acknowledgeAlert(alertId);
      res.json({ success, alertId });
    } catch (err) {
      next(err);
    }
  }

  // 16. AI Executive Assistant
  public static async askExecutiveAssistant(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const rawPrompt =
        req.body?.prompt ||
        req.body?.query ||
        req.body?.message ||
        req.body?.text ||
        'How is the business performing today?';

      const prompt =
        typeof rawPrompt === 'string' && rawPrompt.trim()
          ? rawPrompt.trim()
          : 'How is the business performing today?';

      const user = req.user as any;
      const response = await DecisionIntelligenceService.answerExecutiveQuery(prompt, {
        tenantId: user?.tenantId || 'default',
        branchId: user?.branchId,
        roleName: user?.roleName || user?.role || 'Executive',
        permissions: user?.permissions || [],
      });

      // Audit AI query safely
      try {
        const userId = user?.id || user?._id || user?.userId;
        if (userId && mongoose.isValidObjectId(userId)) {
          await AuditLog.create({
            userId: new mongoose.Types.ObjectId(userId),
            action: 'AI_EXECUTIVE_QUERY',
            targetModel: 'Analytics',
            details: `Prompt: ${prompt.slice(0, 100)}`,
          });
        }
      } catch (auditErr) {
        // Non-blocking audit error
      }

      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  // 17. AI Multi-Horizon Forecast
  public static async getAIForecast(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domain = req.body.domain || 'SALES';
      const timeframe = req.body.timeframe || '30_DAYS';
      const { tenantId } = AnalyticsController.parseFilters(req);

      const forecast = await DecisionIntelligenceService.generateForecast(
        domain,
        timeframe,
        tenantId
      );
      res.json(forecast);
    } catch (err) {
      next(err);
    }
  }

  // 18. What-If Price Simulation
  public static async simulatePrice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { productId, percentageChange } = req.body;
      if (!productId) throw new ValidationError('Product ID is required for price simulation');

      const result = await DecisionIntelligenceService.simulatePriceChange(
        productId,
        Number(percentageChange) || 5
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // 19. What-If Inventory Reorder Simulation
  public static async simulateInventory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { productId, additionalUnits } = req.body;
      if (!productId) throw new ValidationError('Product ID is required for inventory simulation');

      const result = await DecisionIntelligenceService.simulateInventoryReorder(
        productId,
        Number(additionalUnits) || 100
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // 20. What-If Supplier Comparison Simulation
  public static async simulateSupplier(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { productId, orderQuantity } = req.body;
      if (!productId)
        throw new ValidationError('Product ID is required for supplier comparison simulation');

      const result = await DecisionIntelligenceService.simulateSupplierComparison(
        productId,
        Number(orderQuantity) || 500
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // 21. Report Export (CSV / JSON / Summary)
  public static async exportReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { reportType, format } = req.body;
      const { tenantId, period } = AnalyticsController.parseFilters(req);

      const metrics = await BusinessIntelligenceService.getExecutiveMetrics(
        tenantId,
        undefined,
        period
      );

      if (format === 'CSV') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${reportType || 'analytics-report'}-${Date.now()}.csv"`
        );
        const csvContent = `Metric,Value\nGross Sales,${metrics.grossSales}\nDiscounts,${metrics.discounts}\nNet Sales,${metrics.netSales}\nRevenue,${metrics.revenue}\nTotal Orders,${metrics.totalOrders}\nAOV,${metrics.averageOrderValue}\nStockout Rate %,${metrics.stockoutRatePct}\n`;
        res.send(csvContent);
        return;
      }

      res.json({
        reportType: reportType || 'EXECUTIVE_SUMMARY',
        format: format || 'JSON',
        generatedAt: new Date(),
        data: metrics,
      });
    } catch (err) {
      next(err);
    }
  }

  // 22. Dedicated Sales Analytics Endpoint
  public static async getSalesAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { period, comparison, branchId, customStart, customEnd, limit, tenantId } =
        AnalyticsController.parseFilters(req);
      const sales = await BusinessIntelligenceService.getSalesAnalytics(
        tenantId,
        branchId,
        period,
        comparison,
        limit,
        customStart,
        customEnd
      );
      res.json(sales);
    } catch (err) {
      next(err);
    }
  }

  // 22b. Dedicated Inventory Analytics Endpoint
  public static async getInventoryAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const inventory = await BusinessIntelligenceService.getInventoryAnalytics(tenantId);
      res.json(inventory);
    } catch (err) {
      next(err);
    }
  }

  // 23. Dedicated Customer Analytics Endpoint
  public static async getCustomerAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { period, tenantId } = AnalyticsController.parseFilters(req);
      const customers = await BusinessIntelligenceService.getCustomerAnalytics(tenantId, period);
      res.json(customers);
    } catch (err) {
      next(err);
    }
  }

  // 24. Dedicated Supplier Analytics Endpoint
  public static async getSupplierAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const suppliers = await BusinessIntelligenceService.getSupplierAnalytics(tenantId);
      res.json(suppliers);
    } catch (err) {
      next(err);
    }
  }

  // 25. Dedicated Financial Analytics Endpoint
  public static async getFinancialAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { period, customStart, customEnd, tenantId } = AnalyticsController.parseFilters(req);
      const finance = await BusinessIntelligenceService.getFinancialAnalytics(
        tenantId,
        period,
        customStart,
        customEnd
      );
      res.json(finance);
    } catch (err) {
      next(err);
    }
  }

  // 26. Dedicated Forecast Analytics Endpoint
  public static async getForecastAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domain = (req.query.domain as any) || 'SALES';
      const timeframe = (req.query.timeframe as any) || '30_DAYS';
      const { tenantId } = AnalyticsController.parseFilters(req);
      const forecast = await BusinessIntelligenceService.getForecastAnalytics(
        tenantId,
        domain,
        timeframe
      );
      res.json(forecast);
    } catch (err) {
      next(err);
    }
  }

  // 27. Dedicated Anomaly Analytics Endpoint
  public static async getAnomalyAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const anomalies = await BusinessIntelligenceService.getAnomalyAnalytics(tenantId);
      res.json(anomalies);
    } catch (err) {
      next(err);
    }
  }

  // 28. Dedicated KPI Metrics Endpoint
  public static async getKPIMetrics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = AnalyticsController.parseFilters(req);
      const kpis = await BusinessIntelligenceService.getKPIMetrics(tenantId);
      res.json(kpis);
    } catch (err) {
      next(err);
    }
  }

  // 29. Update KPI Target
  public static async updateKPITarget(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { code, targetValue, warningThreshold, criticalThreshold } = req.body;
      if (!code || targetValue === undefined) {
        throw new ValidationError('KPI code and targetValue are required');
      }
      const { tenantId } = AnalyticsController.parseFilters(req);
      const result = await BusinessIntelligenceService.updateKPITarget(
        tenantId,
        String(code),
        Number(targetValue),
        warningThreshold ? Number(warningThreshold) : undefined,
        criticalThreshold ? Number(criticalThreshold) : undefined
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // 30. Resolve & Mute Alerts
  public static async resolveAlert(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const alertId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.json({ success: true, alertId, status: 'RESOLVED' });
    } catch (err) {
      next(err);
    }
  }

  public static async muteAlert(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const alertId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.json({ success: true, alertId, status: 'MUTED' });
    } catch (err) {
      next(err);
    }
  }

  // 31. Direct Multi-Domain Export
  public static async exportAnalyticsData(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { domain = 'EXECUTIVE', format = 'CSV', period = '30_DAYS' } = req.body;
      const { tenantId } = AnalyticsController.parseFilters(req);
      const exportRes = await BusinessIntelligenceService.exportAnalyticsData(
        tenantId,
        String(domain).toUpperCase(),
        String(format).toUpperCase(),
        period as DateFilterPeriod
      );

      res.setHeader('Content-Type', exportRes.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportRes.filename}"`);
      res.send(exportRes.content);
    } catch (err) {
      next(err);
    }
  }
}
