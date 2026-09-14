import crypto from 'crypto';
import axios from 'axios';
import {
  WebhookSubscription,
  type IWebhookSubscription,
  type WebhookEventType,
} from '../models/WebhookSubscription.js';
import { WebhookDeliveryLog } from '../models/WebhookDeliveryLog.js';
import { IntegrationAuditLog } from '../models/IntegrationAuditLog.js';
import { encryptSecret, decryptSecret, signWebhookPayload } from '../utils/encryption.js';
import { executeWithResiliency } from '../utils/resiliency/index.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { logger } from '../logger.js';

export class WebhookService {
  /**
   * Creates a webhook subscription for a tenant with an auto-generated or supplied signing secret.
   */
  public static async createSubscription(
    tenantId: string,
    payload: {
      name: string;
      events: WebhookEventType[];
      endpointUrl: string;
      secret?: string;
      headers?: Record<string, string>;
    },
    createdBy: string
  ): Promise<{ subscription: IWebhookSubscription; secret: string }> {
    if (!payload.endpointUrl || !payload.endpointUrl.startsWith('http')) {
      throw new ValidationError('Valid HTTP/HTTPS endpoint URL is required.');
    }
    if (!payload.events || payload.events.length === 0) {
      throw new ValidationError('At least one event type must be selected.');
    }

    const secret = payload.secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const secretEncrypted = encryptSecret(secret);
    const secretPrefix = `${secret.slice(0, 10)}...`;

    const subscription = await WebhookSubscription.create({
      tenantId,
      name: payload.name,
      events: payload.events,
      endpointUrl: payload.endpointUrl,
      secretEncrypted,
      secretPrefix,
      headers: payload.headers || {},
      createdBy,
    });

    await IntegrationAuditLog.create({
      tenantId,
      action: 'WEBHOOK_CREATED',
      resourceId: subscription._id.toString(),
      details: { name: payload.name, endpointUrl: payload.endpointUrl, events: payload.events },
      performedBy: createdBy,
    });

    return { subscription, secret };
  }

  /**
   * Lists all webhook subscriptions for a tenant (never reveals plain secrets).
   */
  public static async listSubscriptions(tenantId: string): Promise<IWebhookSubscription[]> {
    return WebhookSubscription.find({ tenantId }).sort({ createdAt: -1 });
  }

  /**
   * Deletes a webhook subscription.
   */
  public static async deleteSubscription(
    tenantId: string,
    subscriptionId: string,
    performedBy: string
  ): Promise<void> {
    const sub = await WebhookSubscription.findOneAndDelete({ _id: subscriptionId, tenantId });
    if (!sub) {
      throw new NotFoundError('Webhook subscription not found.');
    }

    await IntegrationAuditLog.create({
      tenantId,
      action: 'WEBHOOK_DELETED',
      resourceId: subscriptionId,
      details: { name: sub.name, endpointUrl: sub.endpointUrl },
      performedBy,
    });
  }

  /**
   * Dispatches an event to all matching active webhook subscriptions for a tenant.
   */
  public static async dispatchEvent(
    tenantId: string,
    event: WebhookEventType,
    data: any
  ): Promise<void> {
    try {
      const subs = await WebhookSubscription.find({
        tenantId,
        events: event,
        status: 'ACTIVE',
      });

      if (!subs || subs.length === 0) return;

      const eventId = `evt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const timestamp = new Date().toISOString();
      const payloadObj = {
        id: eventId,
        event,
        timestamp,
        tenantId,
        data,
      };
      const payloadString = JSON.stringify(payloadObj);

      for (const sub of subs) {
        // Asynchronously deliver each webhook
        this.deliverWebhook(sub, eventId, event, payloadString).catch((err) => {
          logger.error(`Failed to deliver webhook [${sub._id}] for event [${event}]:`, err);
        });
      }
    } catch (err) {
      logger.error(`Error querying subscriptions for event [${event}]:`, err);
    }
  }

  /**
   * Executes outbound delivery with cryptographic signature, resiliency backoff, and delivery logs.
   */
  public static async deliverWebhook(
    sub: IWebhookSubscription,
    eventId: string,
    event: string,
    payloadString: string,
    attemptNumber = 1
  ): Promise<any> {
    const secret = decryptSecret(sub.secretEncrypted);
    const signature = signWebhookPayload(payloadString, secret);
    const startTime = Date.now();

    try {
      const response = await executeWithResiliency(
        async () => {
          return axios.post(sub.endpointUrl, payloadString, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Stockora-Webhook-Engine/1.0',
              'X-Stockora-Event': event,
              'X-Stockora-Event-Id': eventId,
              'X-Stockora-Timestamp': new Date().toISOString(),
              'X-Stockora-Signature': signature,
              ...(sub.headers || {}),
            },
            timeout: 7000,
          });
        },
        {
          name: `WebhookDelivery-${sub._id}`,
          timeoutMs: 8000,
          retryCount: 2,
          backoffType: 'EXPONENTIAL',
          jitterType: 'FULL',
        }
      );

      const durationMs = Date.now() - startTime;

      await WebhookDeliveryLog.create({
        tenantId: sub.tenantId,
        webhookId: sub._id,
        eventId,
        event,
        endpointUrl: sub.endpointUrl,
        attempt: attemptNumber,
        statusCode: response?.status || 200,
        durationMs,
        success: true,
        payloadSnippet: payloadString.slice(0, 1000),
        responseSnippet: JSON.stringify(response?.data || '').slice(0, 1000),
        signature,
        deliveredAt: new Date(),
      });

      sub.lastDeliveredAt = new Date();
      sub.lastDeliveryStatus = 'SUCCESS';
      sub.consecutiveFailures = 0;
      await sub.save();

      return { success: true, statusCode: response?.status || 200 };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const statusCode = err.response?.status;
      const errorMessage = err.message || 'Unknown network error';

      let errorCategory: any = 'NETWORK_ERROR';
      if (err.code === 'ECONNABORTED' || errorMessage.includes('timeout')) {
        errorCategory = 'TIMEOUT';
      } else if (statusCode === 429) {
        errorCategory = 'RATE_LIMITED';
      } else if (statusCode >= 500) {
        errorCategory = 'SERVER_ERROR';
      } else if (statusCode >= 400) {
        errorCategory = 'CLIENT_ERROR';
      }

      await WebhookDeliveryLog.create({
        tenantId: sub.tenantId,
        webhookId: sub._id,
        eventId,
        event,
        endpointUrl: sub.endpointUrl,
        attempt: attemptNumber,
        statusCode,
        durationMs,
        success: false,
        errorCategory,
        errorMessage,
        payloadSnippet: payloadString.slice(0, 1000),
        responseSnippet: err.response?.data
          ? JSON.stringify(err.response.data).slice(0, 1000)
          : undefined,
        signature,
        deliveredAt: new Date(),
      });

      sub.lastDeliveredAt = new Date();
      sub.lastDeliveryStatus = 'FAILED';
      sub.consecutiveFailures = (sub.consecutiveFailures || 0) + 1;
      if (sub.consecutiveFailures >= 10) {
        sub.status = 'DEGRADED';
      }
      await sub.save();

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Replays a previous webhook delivery safely without creating duplicate business events.
   */
  public static async replayDelivery(
    tenantId: string,
    deliveryLogId: string,
    performedBy: string
  ): Promise<any> {
    const log = await WebhookDeliveryLog.findOne({ _id: deliveryLogId, tenantId });
    if (!log) {
      throw new NotFoundError('Delivery log not found.');
    }

    const sub = await WebhookSubscription.findOne({ _id: log.webhookId, tenantId });
    if (!sub) {
      throw new NotFoundError('Webhook subscription no longer exists.');
    }

    await IntegrationAuditLog.create({
      tenantId,
      action: 'WEBHOOK_REPLAYED',
      resourceId: log._id.toString(),
      details: { eventId: log.eventId, event: log.event },
      performedBy,
    });

    return this.deliverWebhook(sub, log.eventId, log.event, log.payloadSnippet, log.attempt + 1);
  }

  /**
   * Retrieves delivery logs for a tenant.
   */
  public static async getDeliveryLogs(tenantId: string, limit = 50): Promise<any[]> {
    return WebhookDeliveryLog.find({ tenantId })
      .sort({ deliveredAt: -1 })
      .limit(limit)
      .populate('webhookId', 'name endpointUrl');
  }
}
