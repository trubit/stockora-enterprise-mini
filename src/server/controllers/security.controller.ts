import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AuthService } from '../services/auth.service.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import mongoose from 'mongoose';
import { redis } from '../database/redis.js';

export class SecurityController {
  // -------------------------------------------------------------------------
  // GET /security/sessions
  // List active sessions for the current user (or for a target user if admin)
  // -------------------------------------------------------------------------
  public static async listActiveSessions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = req.query.userId as string;
      let queryUserId = req.user!.id;

      if (targetUserId && req.user!.roleName === 'admin') {
        queryUserId = targetUserId;
      }

      const sessions = await Session.find({ userId: queryUserId, isActive: true }).sort({
        lastSeenAt: -1,
      });
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // POST /security/sessions/:id/revoke
  // Revoke a specific session
  // -------------------------------------------------------------------------
  public static async revokeSession(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const session = await Session.findById(id);
      if (!session) {
        return next(new NotFoundError('Session not found.'));
      }

      // Check authorization (must be own session or user is admin)
      if (session.userId.toString() !== req.user!.id && req.user!.roleName !== 'admin') {
        return next(new ValidationError("Access Denied: Cannot revoke another user's session."));
      }

      session.isActive = false;
      await session.save();

      // Log audit trail
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(req.user!.id),
        action: 'SESSION_REVOKED',
        targetModel: 'Session',
        targetId: session._id.toString(),
        ipAddress: req.ipAddress,
        userAgent: req.userAgent,
        sessionId: req.sessionId,
        newValues: { revokedSessionId: session._id },
      });

      res.json({ success: true, message: 'Session revoked successfully.' });
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // POST /security/users/:id/force-logout
  // Force logout user across all devices/refresh tokens (Admin only)
  // -------------------------------------------------------------------------
  public static async forceLogoutUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const userExists = await User.findById(id);
      if (!userExists) {
        return next(new NotFoundError('User not found.'));
      }

      await AuthService.forceLogoutUser(String(id), String(req.user!.id));

      res.json({
        success: true,
        message: `User [${userExists.username}] has been logged out from all active sessions.`,
      });
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // GET /security/gdpr/:userId
  // Export all personal data belonging to the user for GDPR compliance
  // -------------------------------------------------------------------------
  public static async exportGDPRData(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { userId } = req.params;
    try {
      // Must be admin or exporting own data
      if (userId !== req.user!.id && req.user!.roleName !== 'admin') {
        return next(new ValidationError('Access Denied: You can only export your own data.'));
      }

      const [user, sessions, auditLogs] = await Promise.all([
        User.findById(userId).select('-password'),
        Session.find({ userId }),
        AuditLog.find({ userId }),
      ]);

      if (!user) {
        return next(new NotFoundError('User not found.'));
      }

      const gdprDump = {
        exportedAt: new Date().toISOString(),
        personalProfile: user,
        recordedSessions: sessions,
        recordedAuditLogs: auditLogs,
      };

      // Log gdpr export action
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(req.user!.id),
        action: 'GDPR_EXPORT',
        targetModel: 'User',
        targetId: userId,
        ipAddress: req.ipAddress,
        userAgent: req.userAgent,
        sessionId: req.sessionId,
      });

      res.json(gdprDump);
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // GET /security/health
  // Comprehensive server health diagnostics (Mongoose, Redis, Node specs)
  // -------------------------------------------------------------------------
  public static async getHealthReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let redisPing = 'FAILED';
      try {
        const ping = await redis.ping();
        redisPing = ping === 'PONG' ? 'HEALTHY' : 'UNHEALTHY';
      } catch {
        redisPing = 'DISCONNECTED';
      }

      const memoryUsage = process.memoryUsage();

      const report = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        uptime: process.uptime(),
        mongoose: {
          connectionState: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
        },
        redis: {
          status: redisPing,
        },
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        },
      };

      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // GET /security/password-policy
  // -------------------------------------------------------------------------
  public static async getPasswordPolicy(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const config = await SystemConfig.findOne();
      res.json(
        config?.passwordPolicy || {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
        }
      );
    } catch (err) {
      next(err);
    }
  }
}
