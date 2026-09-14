import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ObservabilityService } from '../services/observability.service.js';
import { Incident } from '../models/Incident.js';
import { AuditLog } from '../models/AuditLog.js';
import { Company } from '../models/Company.js';
import { AuthorizationError } from '../errors/AppError.js';
import mongoose from 'mongoose';

export class ObservabilityController {
  private static async getCompanyId(req: AuthenticatedRequest): Promise<string> {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      throw new AuthorizationError('Tenant context required for observability.');
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
   * Return live telemetry performance parameters
   */
  public static async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await ObservabilityService.getSystemMetrics();
      res.status(200).json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Return active incident records for a company
   */
  public static async getIncidents(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ObservabilityController.getCompanyId(req);

      const incidents = await Incident.find({ companyId }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: incidents });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Search audit trail changes across target models
   */
  public static async getAuditHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const companyId = await ObservabilityController.getCompanyId(req);

      const { action, targetModel, limit = 50 } = req.query;
      const query: Record<string, string> = { companyId };

      if (action) query.action = action as string;
      if (targetModel) query.targetModel = targetModel as string;

      const logs = await AuditLog.find(query)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .limit(Number(limit));

      res.status(200).json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
}
