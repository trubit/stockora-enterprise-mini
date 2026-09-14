import mongoose, { Schema, type Document } from 'mongoose';

export type CustomerEventType =
  | 'PURCHASE'
  | 'RETURN'
  | 'REFUND'
  | 'LOYALTY_EARNED'
  | 'LOYALTY_REDEEMED'
  | 'LOYALTY_TIER_CHANGED'
  | 'LOYALTY_EXPIRED'
  | 'REWARD_REDEEMED'
  | 'CAMPAIGN_SENT'
  | 'CAMPAIGN_OPENED'
  | 'SUPPORT_NOTE'
  | 'SEGMENT_CHANGE'
  | 'STATUS_CHANGE'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'JOURNEY_STEP_EXECUTED';

export interface ICustomerTimeline extends Document {
  tenantId?: string;
  companyId?: string;
  customerId: mongoose.Types.ObjectId;
  eventType: CustomerEventType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  authorId?: mongoose.Types.ObjectId;
  authorName?: string;
  createdAt: Date;
}

const CustomerTimelineSchema = new Schema<ICustomerTimeline>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    companyId: { type: String, index: true, default: 'default' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    eventType: {
      type: String,
      enum: [
        'PURCHASE',
        'RETURN',
        'REFUND',
        'LOYALTY_EARNED',
        'LOYALTY_REDEEMED',
        'LOYALTY_TIER_CHANGED',
        'LOYALTY_EXPIRED',
        'REWARD_REDEEMED',
        'CAMPAIGN_SENT',
        'CAMPAIGN_OPENED',
        'SUPPORT_NOTE',
        'SEGMENT_CHANGE',
        'STATUS_CHANGE',
        'CUSTOMER_CREATED',
        'CUSTOMER_UPDATED',
        'JOURNEY_STEP_EXECUTED',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CustomerTimelineSchema.index({ customerId: 1, createdAt: -1 });

export const CustomerTimeline = mongoose.model<ICustomerTimeline>(
  'CustomerTimeline',
  CustomerTimelineSchema
);
