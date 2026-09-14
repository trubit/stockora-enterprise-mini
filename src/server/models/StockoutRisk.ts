import mongoose, { Schema, type Document } from 'mongoose';

export type StockoutRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IStockoutRisk extends Document {
  tenantId?: string;
  companyId?: string;
  branchId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  productSku?: string;
  productName?: string;
  riskLevel: StockoutRiskLevel;
  estimatedStockoutDate?: Date;
  daysUntilStockout?: number;
  expectedDailyDemand: number;
  currentStock: number;
  incomingStock: number;
  recommendedAction: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockoutRiskSchema = new Schema<IStockoutRisk>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    companyId: { type: String, index: true, default: 'default' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productSku: { type: String, index: true },
    productName: { type: String },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      default: 'LOW',
      index: true,
    },
    estimatedStockoutDate: { type: Date },
    daysUntilStockout: { type: Number, default: 0 },
    expectedDailyDemand: { type: Number, required: true, default: 0 },
    currentStock: { type: Number, required: true, default: 0 },
    incomingStock: { type: Number, default: 0 },
    recommendedAction: { type: String, required: true },
  },
  { timestamps: true }
);

StockoutRiskSchema.index({ riskLevel: 1, daysUntilStockout: 1 });

export const StockoutRisk = mongoose.model<IStockoutRisk>('StockoutRisk', StockoutRiskSchema);
