import mongoose, { Schema, type Document } from 'mongoose';

export interface IStockAdjustment extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantSku?: string;
  adjustmentNumber: string;
  type: string;
  reason: string;
  quantity: number;
  quantityDelta: number;
  previousQuantity?: number;
  newQuantity?: number;
  notes?: string;
  idempotencyKey?: string;
  userId?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockAdjustmentSchema = new Schema<IStockAdjustment>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantSku: { type: String, trim: true },
    adjustmentNumber: {
      type: String,
      unique: true,
      index: true,
      default: () => `ADJ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
    },
    type: { type: String, default: 'ADJUSTMENT' },
    reason: { type: String, default: 'Stock adjustment' },
    quantity: { type: Number, default: 0 },
    quantityDelta: { type: Number, default: 0 },
    previousQuantity: { type: Number },
    newQuantity: { type: Number },
    notes: { type: String },
    idempotencyKey: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

StockAdjustmentSchema.index({ tenantId: 1, createdAt: -1 });
StockAdjustmentSchema.index({ tenantId: 1, productId: 1 });
StockAdjustmentSchema.index({ tenantId: 1, idempotencyKey: 1 }, { sparse: true });

export const StockAdjustment =
  mongoose.models.StockAdjustment ||
  mongoose.model<IStockAdjustment>('StockAdjustment', StockAdjustmentSchema);
