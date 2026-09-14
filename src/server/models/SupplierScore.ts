import mongoose, { Schema, type Document } from 'mongoose';

export type SupplierRiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ISupplierScore extends Document {
  tenantId?: string;
  companyId?: string;
  supplierId: mongoose.Types.ObjectId;
  supplierName?: string;
  overallScore: number; // 0 - 100
  deliveryPerformanceScore: number; // 0 - 100
  priceStabilityScore: number; // 0 - 100
  qualityScore: number; // 0 - 100
  orderAccuracyScore: number; // 0 - 100
  fillRateScore: number; // 0 - 100
  avgLeadTimeDays: number;
  leadTimeVarianceDays: number;
  riskTier: SupplierRiskTier;
  totalOrdersEvaluated: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierScoreSchema = new Schema<ISupplierScore>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    companyId: { type: String, index: true, default: 'default' },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      unique: true,
      index: true,
    },
    supplierName: { type: String },
    overallScore: { type: Number, required: true, min: 0, max: 100, default: 80 },
    deliveryPerformanceScore: { type: Number, required: true, min: 0, max: 100, default: 80 },
    priceStabilityScore: { type: Number, required: true, min: 0, max: 100, default: 80 },
    qualityScore: { type: Number, required: true, min: 0, max: 100, default: 80 },
    orderAccuracyScore: { type: Number, required: true, min: 0, max: 100, default: 80 },
    fillRateScore: { type: Number, required: true, min: 0, max: 100, default: 80 },
    avgLeadTimeDays: { type: Number, default: 7 },
    leadTimeVarianceDays: { type: Number, default: 0 },
    riskTier: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'LOW',
      index: true,
    },
    totalOrdersEvaluated: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

export const SupplierScore = mongoose.model<ISupplierScore>('SupplierScore', SupplierScoreSchema);
