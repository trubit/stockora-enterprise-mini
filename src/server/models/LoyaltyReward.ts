import mongoose, { Schema, type Document } from 'mongoose';

export type RewardType =
  'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'FREE_PRODUCT' | 'FREE_SHIPPING' | 'VOUCHER';

export interface ILoyaltyReward extends Document {
  tenantId: string;
  name: string;
  code: string;
  description?: string;
  rewardType: RewardType;
  pointsCost: number;
  discountValue?: number;
  productId?: mongoose.Types.ObjectId;
  minimumTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  stockLimit?: number;
  redeemedCount: number;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  termsAndConditions?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LoyaltyRewardSchema = new Schema<ILoyaltyReward>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String },
    rewardType: {
      type: String,
      enum: ['DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'FREE_PRODUCT', 'FREE_SHIPPING', 'VOUCHER'],
      required: true,
      default: 'DISCOUNT_FIXED',
    },
    pointsCost: { type: Number, required: true, min: 1 },
    discountValue: { type: Number, default: 0 },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    minimumTier: {
      type: String,
      enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
      default: 'BRONZE',
    },
    stockLimit: { type: Number },
    redeemedCount: { type: Number, default: 0, min: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    termsAndConditions: { type: String },
  },
  { timestamps: true }
);

LoyaltyRewardSchema.index({ tenantId: 1, code: 1 }, { unique: true });
LoyaltyRewardSchema.index({ tenantId: 1, isActive: 1, minimumTier: 1 });

export const LoyaltyReward = mongoose.model<ILoyaltyReward>('LoyaltyReward', LoyaltyRewardSchema);
