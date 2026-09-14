import mongoose, { Schema, type Document } from 'mongoose';

export interface IReplenishmentRule extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  reorderPoint: number;
  safetyStock: number;
  maxStockLevel?: number;
  orderMultiple?: number;
  minimumOrderQuantity?: number;
  leadTimeDays?: number;
  autoApprovePurchaseRequest?: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReplenishmentRuleSchema = new Schema<IReplenishmentRule>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    reorderPoint: { type: Number, required: true, default: 10, min: 0 },
    safetyStock: { type: Number, required: true, default: 5, min: 0 },
    maxStockLevel: { type: Number, default: 100, min: 0 },
    orderMultiple: { type: Number, default: 1, min: 1 },
    minimumOrderQuantity: { type: Number, default: 1, min: 1 },
    leadTimeDays: { type: Number, default: 7, min: 0 },
    autoApprovePurchaseRequest: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

ReplenishmentRuleSchema.index({ warehouseId: 1, productId: 1 }, { unique: true });

export const ReplenishmentRule =
  mongoose.models.ReplenishmentRule ||
  mongoose.model<IReplenishmentRule>('ReplenishmentRule', ReplenishmentRuleSchema);
