import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';
import { NotificationTemplate } from '../models/NotificationTemplate.js';
import { NotificationService } from '../services/notification.service.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';

export class NotificationController {
  // -------------------------------------------------------------------------
  // Notifications for the current user
  // -------------------------------------------------------------------------

  public static async listNotifications(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { unreadOnly } = req.query;
      const filter: Record<string, unknown> = {
        $or: [
          { userId: req.user?.id },
          { userId: { $exists: false }, targetRole: { $exists: false } }, // Global broadcasts
          { targetRole: req.user?.roleName }, // Role-targeted
        ],
      };
      if (unreadOnly === 'true') filter.status = 'UNREAD';

      const list = await Notification.find(filter).sort({ createdAt: -1 }).limit(100);
      res.json(list);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async markRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const notification = await Notification.findById(id);
      if (!notification) return next(new NotFoundError('Notification not found.'));
      notification.status = 'READ';
      await notification.save();
      res.json(notification);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async markAllRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const count = await NotificationService.markAllRead(req.user!.id);
      res.json({ success: true, markedRead: count });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async deleteNotification(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const notification = await Notification.findByIdAndDelete(id);
      if (!notification) return next(new NotFoundError('Notification not found.'));
      res.json({ success: true });
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Broadcast
  // -------------------------------------------------------------------------

  public static async broadcast(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { type, title, body, channels, targetRole, scheduledAt, metadata } = req.body;
    if (!type || !title || !body) {
      return next(new ValidationError('Type, title, and body are required.'));
    }

    try {
      if (targetRole) {
        await NotificationService.sendToRole(targetRole, {
          type,
          title,
          body,
          channels: channels || ['IN_APP'],
          metadata,
        });
      } else {
        await NotificationService.send({
          type,
          title,
          body,
          channels: channels || ['IN_APP'],
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          metadata,
        });
      }

      res.status(201).json({ success: true, message: 'Notification dispatched.' });
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  public static async listTemplates(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const templates = await NotificationTemplate.find().sort({ createdAt: -1 });
      res.json(templates);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { key, name, type, channels, titleTemplate, bodyTemplate } = req.body;
    if (!key || !name || !type || !titleTemplate || !bodyTemplate) {
      return next(
        new ValidationError('key, name, type, titleTemplate, and bodyTemplate are required.')
      );
    }
    try {
      const existing = await NotificationTemplate.findOne({ key: key.toUpperCase() });
      if (existing)
        return next(new ValidationError(`Template key [${key.toUpperCase()}] already exists.`));
      const template = await NotificationTemplate.create({
        key: key.toUpperCase(),
        name,
        type,
        channels: channels || ['IN_APP'],
        titleTemplate,
        bodyTemplate,
        isActive: true,
      });
      res.status(201).json(template);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const template = await NotificationTemplate.findByIdAndUpdate(id, req.body, { new: true });
      if (!template) return next(new NotFoundError('Template not found.'));
      res.json(template);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async deleteTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const template = await NotificationTemplate.findByIdAndDelete(id);
      if (!template) return next(new NotFoundError('Template not found.'));
      res.json({ success: true });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async sendFromTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { templateKey, vars, userId, targetRole } = req.body;
    if (!templateKey || !vars) {
      return next(new ValidationError('templateKey and vars are required.'));
    }
    try {
      await NotificationService.sendFromTemplate(templateKey, vars as Record<string, string>, {
        userId,
        targetRole,
      });
      res.status(201).json({ success: true });
    } catch (err: unknown) {
      next(err);
    }
  }
}
