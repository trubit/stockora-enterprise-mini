import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ReportingService } from '../services/reporting.service.js';
import { SavedReport } from '../models/SavedReport.js';
import { ScheduledReport } from '../models/ScheduledReport.js';
import { ExportHistory } from '../models/ExportHistory.js';
import { AuditLog } from '../models/AuditLog.js';
import { Company } from '../models/Company.js';
import { AuthorizationError } from '../errors/AppError.js';
import { z } from 'zod';
import mongoose from 'mongoose';

// Validation schemas
const saveReportSchema = z.object({
  name: z.string().min(1),
  templateId: z.string(),
  configuration: z.object({
    fields: z.array(z.string()),
    filters: z.record(z.any()).optional().default({}),
    groupings: z.array(z.string()).optional(),
    sorting: z.record(z.enum(['asc', 'desc'])).optional(),
    aggregations: z.array(z.string()).optional(),
    chartType: z.enum(['line', 'bar', 'pie', 'area']).optional(),
  }),
});

const scheduleReportSchema = z.object({
  savedReportId: z.string(),
  name: z.string().min(1),
  cronExpression: z.string().min(5),
  format: z.enum(['PDF', 'EXCEL', 'CSV', 'JSON']),
  recipients: z.array(z.string().email()),
});

export class ReportingController {
  private static async getCompanyId(req: AuthenticatedRequest): Promise<string> {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      throw new AuthorizationError('Tenant context required for reporting operations.');
    }

    if (mongoose.Types.ObjectId.isValid(tenantId)) {
      const comp = await Company.findOne({
        $or: [
          { tenantId: new mongoose.Types.ObjectId(tenantId) },
          { _id: new mongoose.Types.ObjectId(tenantId) },
        ],
      });
      if (comp) return comp._id.toString();
      return tenantId;
    }

    const comp = await Company.findOne({ tenantId });
    if (comp) return comp._id.toString();
    return tenantId;
  }

  /**
   * Executive Dashboard Summary
   */
  public static async getExecutiveSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const roleName = req.user?.roleName || 'Employee';

      const summary = await ReportingService.getExecutiveSummary(companyId, roleName);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Inventory Valuation Report
   */
  public static async getInventoryReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const report = await ReportingService.getInventoryReport(companyId);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Sales Performance Report
   */
  public static async getSalesReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const { startDate, endDate } = req.query;
      const report = await ReportingService.getSalesReport(
        companyId,
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  /**
   * KPI Indicators list
   */
  public static async getKPIs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const kpis = await ReportingService.getKPIs(companyId);
      res.json(kpis);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Save custom report layout configuration
   */
  public static async saveReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const userId = req.user?.id;

      if (!userId) {
        res.status(400).json({ error: 'Authentication details missing.' });
        return;
      }

      const parsed = saveReportSchema.parse(req.body);

      const saved = await SavedReport.create({
        userId: new mongoose.Types.ObjectId(userId),
        companyId: new mongoose.Types.ObjectId(companyId),
        name: parsed.name,
        templateId: new mongoose.Types.ObjectId(parsed.templateId),
        configuration: {
          fields: parsed.configuration.fields,
          filters: parsed.configuration.filters,
          groupings: parsed.configuration.groupings || [],
          sorting: parsed.configuration.sorting || {},
          aggregations: parsed.configuration.aggregations || [],
          chartType: parsed.configuration.chartType,
        },
      });

      // Audit Log
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(userId),
        action: 'CREATE_SAVED_REPORT',
        targetModel: 'SavedReport',
        targetId: saved._id.toString(),
        newValues: saved.toObject(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  }

  /**
   * List saved reports
   */
  public static async getSavedReports(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const list = await SavedReport.find({ companyId, isArchived: false }).sort({ createdAt: -1 });
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create scheduled report delivery
   */
  public static async createSchedule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const userId = req.user?.id;

      if (!userId) {
        res.status(400).json({ error: 'Authentication details missing.' });
        return;
      }

      const parsed = scheduleReportSchema.parse(req.body);

      const schedule = await ScheduledReport.create({
        savedReportId: new mongoose.Types.ObjectId(parsed.savedReportId),
        userId: new mongoose.Types.ObjectId(userId),
        companyId: new mongoose.Types.ObjectId(companyId),
        name: parsed.name,
        cronExpression: parsed.cronExpression,
        format: parsed.format,
        recipients: parsed.recipients,
      });

      res.status(201).json(schedule);
    } catch (err) {
      next(err);
    }
  }

  /**
   * List scheduled reports
   */
  public static async getScheduledReports(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const list = await ScheduledReport.find({ companyId }).sort({ createdAt: -1 });
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Request report export download center history
   */
  public static async getExportHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ReportingController.getCompanyId(req);
      const list = await ExportHistory.find({ companyId }).sort({ createdAt: -1 });
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
}
