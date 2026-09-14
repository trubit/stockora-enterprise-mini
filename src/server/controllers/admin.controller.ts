import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { AuditLog } from '../models/AuditLog.js';
import mongoose from 'mongoose';

export class AdminController {
  // --- System Configuration & Maintenance Mode ---
  public static async getSettings(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let config = await SystemConfig.findOne();
      if (!config) {
        config = await SystemConfig.create({
          maintenanceMode: false,
          featureFlags: new Map([
            ['loyaltyProgram', true],
            ['offlinePOS', true],
            ['returns exchanges', true],
          ]),
          allowedIPs: [],
          deniedIPs: [],
          maxConcurrentSessions: 3,
          sessionTimeoutMinutes: 60,
        });
      }
      res.json(config);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateSettings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const {
      maintenanceMode,
      featureFlags,
      allowedIPs,
      deniedIPs,
      maxConcurrentSessions,
      sessionTimeoutMinutes,
      passwordPolicy,
    } = req.body;

    try {
      let config = await SystemConfig.findOne();
      if (!config) {
        config = new SystemConfig();
      }

      const prev = config.toObject();

      if (maintenanceMode !== undefined) config.maintenanceMode = !!maintenanceMode;
      if (featureFlags !== undefined) {
        // Map feature flags from object to map if needed
        config.featureFlags = new Map(Object.entries(featureFlags));
      }
      if (allowedIPs !== undefined) config.allowedIPs = allowedIPs;
      if (deniedIPs !== undefined) config.deniedIPs = deniedIPs;
      if (maxConcurrentSessions !== undefined)
        config.maxConcurrentSessions = Number(maxConcurrentSessions);
      if (sessionTimeoutMinutes !== undefined)
        config.sessionTimeoutMinutes = Number(sessionTimeoutMinutes);
      if (passwordPolicy !== undefined) {
        config.passwordPolicy = {
          minLength: Number(passwordPolicy.minLength || 8),
          requireUppercase: !!passwordPolicy.requireUppercase,
          requireLowercase: !!passwordPolicy.requireLowercase,
          requireNumbers: !!passwordPolicy.requireNumbers,
          requireSpecialChars: !!passwordPolicy.requireSpecialChars,
        };
      }

      config.updatedBy = new mongoose.Types.ObjectId(req.user?.id);

      await config.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'SystemConfig',
        targetId: config._id.toString(),
        previousValues: prev,
        newValues: config.toObject(),
        ipAddress: req.ipAddress,
        userAgent: req.userAgent,
        sessionId: req.sessionId,
      });

      res.json(config);
    } catch (err: unknown) {
      next(err);
    }
  }

  // --- Filtered and Paginated Audit Logs ---
  public static async listAuditLogs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page = 1, limit = 50, action, targetModel, userId, startDate, endDate } = req.query;

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.max(1, Math.min(100, Number(limit))); // Max 100 per page

      const queryFilter: Record<string, unknown> = {};

      if (action) {
        queryFilter.action = action;
      }
      if (targetModel) {
        queryFilter.targetModel = targetModel;
      }
      if (userId) {
        queryFilter.userId = new mongoose.Types.ObjectId(userId as string);
      }
      if (startDate || endDate) {
        const dateFilter: Record<string, unknown> = {};
        if (startDate) {
          dateFilter.$gte = new Date(startDate as string);
        }
        if (endDate) {
          dateFilter.$lte = new Date(endDate as string);
        }
        queryFilter.createdAt = dateFilter;
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(queryFilter)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .populate('userId', 'username email'),
        AuditLog.countDocuments(queryFilter),
      ]);

      res.json({
        logs,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (err: unknown) {
      next(err);
    }
  }
}
