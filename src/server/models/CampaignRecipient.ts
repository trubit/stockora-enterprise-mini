import mongoose, { Schema, type Document } from 'mongoose';

export type RecipientStatus =
  'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED' | 'OPENED' | 'CLICKED';

export interface ICampaignRecipient extends Document {
  tenantId: string;
  campaignId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  recipientAddress: string; // Email or Phone
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';
  status: RecipientStatus;
  idempotencyKey: string;
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignRecipientSchema = new Schema<ICampaignRecipient>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'MarketingCampaign',
      required: true,
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    recipientAddress: { type: String, required: true },
    channel: {
      type: String,
      enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'],
      required: true,
    },
    status: {
      type: String,
      enum: ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'OPENED', 'CLICKED'],
      default: 'QUEUED',
      index: true,
    },
    idempotencyKey: { type: String, required: true, index: true },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    deliveredAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    errorMessage: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

CampaignRecipientSchema.index({ tenantId: 1, campaignId: 1, customerId: 1 }, { unique: true });
CampaignRecipientSchema.index({ tenantId: 1, status: 1 });

export const CampaignRecipient = mongoose.model<ICampaignRecipient>(
  'CampaignRecipient',
  CampaignRecipientSchema
);
