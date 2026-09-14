import mongoose, { Schema, type Document } from 'mongoose';

export interface IPromotion extends Document {
  code: string;
  type: 'PERCENTAGE' | 'FIXED' | 'BOGO' | 'BUNDLE';
  value: number;
  minPurchase: number;
  usageLimit?: number;
  usageCount: number;
  startDate?: Date;
  expiresAt: Date;
  isActive: boolean;
  // Scoping: applies to specific categories, brands, or products
  applicableCategories: string[];
  applicableBrands: string[];
  applicableProducts: mongoose.Types.ObjectId[];
  // Customer-specific targeting
  customerSpecific: boolean;
  allowedCustomers: mongoose.Types.ObjectId[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['PERCENTAGE', 'FIXED', 'BOGO', 'BUNDLE'],
      default: 'PERCENTAGE',
    },
    value: { type: Number, required: true, min: 0 },
    minPurchase: { type: Number, required: true, default: 0, min: 0 },
    usageLimit: { type: Number },
    usageCount: { type: Number, required: true, default: 0, min: 0 },
    startDate: { type: Date },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true, index: true },
    applicableCategories: [{ type: String }],
    applicableBrands: [{ type: String }],
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    customerSpecific: { type: Boolean, default: false },
    allowedCustomers: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
    description: { type: String },
  },
  { timestamps: true }
);

PromotionSchema.index({ expiresAt: 1, isActive: 1 });

export const Promotion = mongoose.model<IPromotion>('Promotion', PromotionSchema);
