import mongoose, { Schema, type Document } from 'mongoose';

export interface IWebhookDeliveryLog extends Document {
  tenantId: string;
  webhookId: mongoose.Types.ObjectId;
  eventId: string;
  event: string;
  endpointUrl: string;
  attempt: number;
  statusCode?: number;
  durationMs: number;
  success: boolean;
  errorCategory?:
    | 'NETWORK_ERROR'
    | 'TIMEOUT'
    | 'RATE_LIMITED'
    | 'AUTHENTICATION_ERROR'
    | 'SERVER_ERROR'
    | 'CLIENT_ERROR'
    | 'UNKNOWN_ERROR';
  errorMessage?: string;
  payloadSnippet: string;
  responseSnippet?: string;
  signature: string;
  deliveredAt: Date;
  createdAt: Date;
}

const WebhookDeliveryLogSchema = new Schema<IWebhookDeliveryLog>(
  {
    tenantId: { type: String, required: true, index: true },
    webhookId: {
      type: Schema.Types.ObjectId,
      ref: 'WebhookSubscription',
      required: true,
      index: true,
    },
    eventId: { type: String, required: true, index: true },
    event: { type: String, required: true, index: true },
    endpointUrl: { type: String, required: true },
    attempt: { type: Number, required: true, default: 1 },
    statusCode: { type: Number },
    durationMs: { type: Number, default: 0 },
    success: { type: Boolean, required: true, index: true },
    errorCategory: {
      type: String,
      enum: [
        'NETWORK_ERROR',
        'TIMEOUT',
        'RATE_LIMITED',
        'AUTHENTICATION_ERROR',
        'SERVER_ERROR',
        'CLIENT_ERROR',
        'UNKNOWN_ERROR',
      ],
    },
    errorMessage: { type: String },
    payloadSnippet: { type: String, required: true },
    responseSnippet: { type: String },
    signature: { type: String, required: true },
    deliveredAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically purge old delivery logs after 30 days
WebhookDeliveryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
WebhookDeliveryLogSchema.index({ tenantId: 1, eventId: 1 });

export const WebhookDeliveryLog = mongoose.model<IWebhookDeliveryLog>(
  'WebhookDeliveryLog',
  WebhookDeliveryLogSchema
);
