import mongoose, { Schema, type Document } from 'mongoose';

export type RedemptionStatus = 'RESERVED' | 'COMPLETED' | 'CANCELLED' | 'REVERSED';

export interface IRewardRedemption extends Document {
  tenantId: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail?: string;
  rewardId?: mongoose.Types.ObjectId;
  rewardName: string;
  rewardCode: string;
  pointsDeducted: number;
  redemptionCode: string;
  status: RedemptionStatus;
  idempotencyKey: string;
  expiresAt?: Date;
  redeemedAt: Date;
  completedAt?: Date;
  orderId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RewardRedemptionSchema = new Schema<IRewardRedemption>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: '' },
    rewardId: { type: Schema.Types.ObjectId, ref: 'LoyaltyReward', required: false, index: true },
    rewardName: { type: String, required: true },
    rewardCode: { type: String, required: true },
    pointsDeducted: { type: Number, required: true, min: 1 },
    redemptionCode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['RESERVED', 'COMPLETED', 'CANCELLED', 'REVERSED'],
      default: 'COMPLETED',
      index: true,
    },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date },
    redeemedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true }
);

RewardRedemptionSchema.index({ tenantId: 1, customerId: 1, status: 1 });
RewardRedemptionSchema.index({ tenantId: 1, createdAt: -1 });

export const RewardRedemption = mongoose.model<IRewardRedemption>(
  'RewardRedemption',
  RewardRedemptionSchema
);
