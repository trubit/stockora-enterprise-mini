import mongoose, { Schema, type Document } from 'mongoose';

export type WebhookEventType =
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'inventory.updated'
  | 'inventory.low_stock'
  | 'order.created'
  | 'order.updated'
  | 'order.completed'
  | 'order.cancelled'
  | 'customer.created'
  | 'customer.updated'
  | 'supplier.created'
  | 'payment.completed'
  | 'invoice.issued'
  | 'integration.sync_completed'
  | 'import.completed'
  | 'export.completed';

export interface IWebhookSubscription extends Document {
  tenantId: string;
  name: string;
  events: WebhookEventType[];
  endpointUrl: string;
  secretEncrypted: string;
  secretPrefix: string;
  status: 'ACTIVE' | 'PAUSED' | 'FAILED' | 'DISABLED' | 'DEGRADED';
  consecutiveFailures: number;
  maxRetries: number;
  headers?: Record<string, string>;
  lastDeliveredAt?: Date;
  lastDeliveryStatus?: 'SUCCESS' | 'FAILED';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSubscriptionSchema = new Schema<IWebhookSubscription>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    events: {
      type: [String],
      required: true,
      index: true,
    },
    endpointUrl: { type: String, required: true },
    secretEncrypted: { type: String, required: true },
    secretPrefix: { type: String, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'PAUSED', 'FAILED', 'DISABLED', 'DEGRADED'],
      default: 'ACTIVE',
      index: true,
    },
    consecutiveFailures: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    headers: { type: Schema.Types.Mixed, default: {} },
    lastDeliveredAt: { type: Date },
    lastDeliveryStatus: { type: String, enum: ['SUCCESS', 'FAILED'] },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

WebhookSubscriptionSchema.index({ tenantId: 1, status: 1 });

export const WebhookSubscription = mongoose.model<IWebhookSubscription>(
  'WebhookSubscription',
  WebhookSubscriptionSchema
);
