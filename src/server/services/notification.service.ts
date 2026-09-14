/**
 * notification.service.ts
 * Centralised notification dispatch engine.
 *
 * Features:
 *  - send()         : immediate single-user or global dispatch
 *  - sendToRole()   : broadcast to all users with a given roleName
 *  - sendFromTemplate(): interpolate a stored template and dispatch
 *  - scheduleNotification(): persist with scheduledAt for deferred delivery
 *  - markAllRead()  : bulk-read for a user
 *  - deleteOld()    : housekeeping — delete read notifications older than N days
 *
 * Provider interfaces (SMS, PUSH) are defined here as abstractions so real
 * integrations (Twilio, FCM) can be dropped in without touching this class.
 */

import mongoose from 'mongoose';
import { Notification, type INotification } from '../models/Notification.js';
import { NotificationTemplate } from '../models/NotificationTemplate.js';
import { User } from '../models/User.js';
import { EmailService } from './email.service.js';
import { SocketManager } from '../sockets/manager.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Provider interfaces — swap real implementations via DI / env config
// ---------------------------------------------------------------------------

export interface ISmsProvider {
  send(to: string, message: string): Promise<void>;
}

export interface IPushProvider {
  send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void>;
}

// Default fallback providers (in production, inject Twilio / FCM drivers)
const defaultSmsProvider: ISmsProvider = {
  async send(to, message) {
    logger.info(`[SMS Dispatch] → ${to}: ${message}`);
  },
};

const defaultPushProvider: IPushProvider = {
  async send(deviceToken, title, body) {
    logger.info(`[PUSH Dispatch] → ${deviceToken}: [${title}] ${body}`);
  },
};

// ---------------------------------------------------------------------------
// Send params type
// ---------------------------------------------------------------------------

export interface SendNotificationParams {
  userId?: string | mongoose.Types.ObjectId;
  targetRole?: string;
  type: INotification['type'];
  title: string;
  body: string;
  channels?: INotification['channels'];
  templateKey?: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
  // Providers — injected for testability / custom drivers
  smsProvider?: ISmsProvider;
  pushProvider?: IPushProvider;
}

// ---------------------------------------------------------------------------
// Template interpolation
// ---------------------------------------------------------------------------

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

export class NotificationService {
  /**
   * Core dispatch — persists to DB, emits via WebSocket, and delegates to configured channels.
   */
  public static async send(params: SendNotificationParams): Promise<INotification> {
    const {
      userId,
      targetRole,
      type,
      title,
      body,
      channels = ['IN_APP'],
      templateKey,
      scheduledAt,
      metadata,
      smsProvider = defaultSmsProvider,
      pushProvider = defaultPushProvider,
    } = params;

    const dbUserId = userId ? new mongoose.Types.ObjectId(userId.toString()) : undefined;

    const notification = await Notification.create({
      userId: dbUserId,
      targetRole,
      type,
      title,
      body,
      status: 'UNREAD',
      channels,
      templateKey,
      scheduledAt,
      sentAt: scheduledAt ? undefined : new Date(),
      metadata,
    });

    // If scheduledAt is in the future, skip immediate dispatch (handled by scheduler)
    if (scheduledAt && scheduledAt > new Date()) {
      logger.info(`[Notification] Scheduled for ${scheduledAt.toISOString()}: "${title}"`);
      return notification;
    }

    // IN_APP — WebSocket
    if (channels.includes('IN_APP')) {
      const socketPayload = {
        id: notification._id,
        userId: dbUserId?.toString(),
        targetRole,
        type,
        title,
        body,
        status: 'UNREAD',
        createdAt: notification.createdAt,
        metadata,
      };

      if (targetRole) {
        SocketManager.getInstance().emitToRoom(
          `role:${targetRole}`,
          'notification:received',
          socketPayload
        );
      } else if (dbUserId) {
        SocketManager.getInstance().emitToRoom(
          `user:${dbUserId}`,
          'notification:received',
          socketPayload
        );
      } else {
        SocketManager.getInstance().emitGlobal('notification:received', socketPayload);
      }
    }

    // EMAIL — dispatch via real EmailService
    if (channels.includes('EMAIL')) {
      try {
        let recipientEmail: string | undefined =
          typeof metadata?.email === 'string' ? metadata.email : undefined;
        if (!recipientEmail && dbUserId) {
          const user = await User.findById(dbUserId).select('email').lean();
          if (user && (user as any).email) {
            recipientEmail = (user as any).email;
          }
        }
        if (recipientEmail) {
          await EmailService.send({
            to: recipientEmail,
            subject: title,
            text: body,
          });
        } else {
          logger.info(
            `[NotificationService] EMAIL channel skipped: no recipient email for user [${userId || targetRole || 'ALL'}]`
          );
        }
      } catch (err) {
        logger.error('[NotificationService] Failed to dispatch notification email:', err);
      }
    }

    // SMS — provider abstraction
    if (channels.includes('SMS')) {
      await smsProvider
        .send('placeholder_number', body)
        .catch((err) => logger.error('[SMS dispatch failed]', err));
    }

    // PUSH — provider abstraction
    if (channels.includes('PUSH')) {
      await pushProvider
        .send('placeholder_token', title, body)
        .catch((err) => logger.error('[PUSH dispatch failed]', err));
    }

    return notification;
  }

  /**
   * Broadcast to all users with a specific roleName.
   * Creates one Notification record per matched user for read-status tracking.
   */
  public static async sendToRole(
    roleName: string,
    params: Omit<SendNotificationParams, 'userId' | 'targetRole'>
  ): Promise<void> {
    const users = await User.find({ roleName, isActive: true }).select('_id');
    const results = users.map((u) =>
      NotificationService.send({ ...params, userId: u._id.toString(), targetRole: roleName }).catch(
        (err) => logger.error(`[sendToRole] Failed for user ${u._id}:`, err)
      )
    );
    await Promise.allSettled(results);
    logger.info(`[Notification] Role broadcast to ${users.length} users with role "${roleName}"`);
  }

  /**
   * Interpolate a stored template and dispatch.
   * vars: map of placeholder → value, e.g. { orderNumber: 'TXN-001', customerName: 'Alice' }
   */
  public static async sendFromTemplate(
    templateKey: string,
    vars: Record<string, string>,
    opts: Partial<SendNotificationParams>
  ): Promise<void> {
    const template = await NotificationTemplate.findOne({
      key: templateKey.toUpperCase(),
      isActive: true,
    });
    if (!template) {
      logger.warn(`[Notification] Template "${templateKey}" not found or inactive.`);
      return;
    }

    await NotificationService.send({
      ...opts,
      type: template.type,
      title: interpolate(template.titleTemplate, vars),
      body: interpolate(template.bodyTemplate, vars),
      channels: template.channels,
      templateKey: template.key,
    });
  }

  /**
   * Bulk-mark all UNREAD notifications for a user as READ.
   */
  public static async markAllRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      {
        $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: { $exists: false } }],
        status: 'UNREAD',
      },
      { $set: { status: 'READ' } }
    );
    return result.modifiedCount;
  }

  /**
   * Delete READ notifications older than `daysOld` for a given user (GDPR-friendly housekeeping).
   */
  public static async deleteOld(userId: string, daysOld = 90): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'READ',
      createdAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }

  /**
   * Dispatch all pending scheduled notifications that are now due.
   * Called by the background job scheduler on a cron interval.
   */
  public static async flushScheduled(): Promise<void> {
    const due = await Notification.find({
      scheduledAt: { $lte: new Date() },
      sentAt: { $exists: false },
    });

    for (const notif of due) {
      SocketManager.getInstance().emitGlobal('notification:received', {
        id: notif._id,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        status: 'UNREAD',
        createdAt: notif.createdAt,
      });
      notif.sentAt = new Date();
      await notif.save();
    }

    if (due.length > 0) {
      logger.info(`[Notification] Flushed ${due.length} scheduled notification(s).`);
    }
  }
}
