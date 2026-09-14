import mongoose, { Schema, type Document } from 'mongoose';

export type CampaignType =
  | 'PROMOTIONAL'
  | 'PRODUCT_ANNOUNCEMENT'
  | 'LOYALTY'
  | 'RE_ENGAGEMENT'
  | 'WIN_BACK'
  | 'WELCOME'
  | 'SEASONAL'
  | 'CLEARANCE';

export type CampaignStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export type CampaignChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';

export interface IMarketingCampaign extends Document {
  tenantId: string;
  companyId?: string;
  title: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  channel: CampaignChannel;
  targetSegmentId?: mongoose.Types.ObjectId;
  targetSegmentName?: string;
  messageSubject?: string;
  messageTemplate: string;
  couponCode?: string;
  budgetCost?: number;
  scheduledAt?: Date;
  sentAt?: Date;
  completedAt?: Date;
  stats: {
    targetCount: number;
    sentCount: number;
    deliveredCount: number;
    openedCount: number;
    clickedCount: number;
    convertedCount: number;
    totalRevenue: number;
    failedCount: number;
  };
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MarketingCampaignSchema = new Schema<IMarketingCampaign>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, index: true, default: 'default' },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    type: {
      type: String,
      enum: [
        'PROMOTIONAL',
        'PRODUCT_ANNOUNCEMENT',
        'LOYALTY',
        'RE_ENGAGEMENT',
        'WIN_BACK',
        'WELCOME',
        'SEASONAL',
        'CLEARANCE',
      ],
      required: true,
      default: 'PROMOTIONAL',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    channel: {
      type: String,
      enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'],
      required: true,
      default: 'EMAIL',
    },
    targetSegmentId: { type: Schema.Types.ObjectId, ref: 'CustomerSegment', index: true },
    targetSegmentName: { type: String },
    messageSubject: { type: String },
    messageTemplate: { type: String, required: true },
    couponCode: { type: String },
    budgetCost: { type: Number, default: 0 },
    scheduledAt: { type: Date, index: true },
    sentAt: { type: Date },
    completedAt: { type: Date },
    stats: {
      targetCount: { type: Number, default: 0 },
      sentCount: { type: Number, default: 0 },
      deliveredCount: { type: Number, default: 0 },
      openedCount: { type: Number, default: 0 },
      clickedCount: { type: Number, default: 0 },
      convertedCount: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

MarketingCampaignSchema.index({ tenantId: 1, status: 1, scheduledAt: 1 });

export const MarketingCampaign = mongoose.model<IMarketingCampaign>(
  'MarketingCampaign',
  MarketingCampaignSchema
);
