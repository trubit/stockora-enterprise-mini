import mongoose, { Schema, type Document } from 'mongoose';

export type LandedCostAllocationMethod =
  'BY_QUANTITY' | 'BY_VALUE' | 'BY_WEIGHT' | 'BY_VOLUME' | 'EQUAL';

export interface ILandedCostItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  quantity: number;
  baseCost: number;
  allocatedLandedCost: number;
  finalUnitCost: number;
}

export interface ILandedCostAllocation extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  purchaseOrderId?: mongoose.Types.ObjectId;
  goodsReceiptId?: mongoose.Types.ObjectId;
  allocationNumber: string;
  totalFreightCost: number;
  totalCustomsDuty: number;
  totalInsuranceCost: number;
  otherCosts: number;
  totalLandedCost: number;
  allocationMethod: LandedCostAllocationMethod;
  items: ILandedCostItem[];
  status: 'DRAFT' | 'APPLIED' | 'CANCELLED';
  appliedBy?: mongoose.Types.ObjectId;
  appliedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LandedCostItemSchema = new Schema<ILandedCostItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    baseCost: { type: Number, required: true, min: 0 },
    allocatedLandedCost: { type: Number, required: true, default: 0, min: 0 },
    finalUnitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const LandedCostAllocationSchema = new Schema<ILandedCostAllocation>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
    goodsReceiptId: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt', index: true },
    allocationNumber: { type: String, required: true, unique: true, index: true },
    totalFreightCost: { type: Number, default: 0, min: 0 },
    totalCustomsDuty: { type: Number, default: 0, min: 0 },
    totalInsuranceCost: { type: Number, default: 0, min: 0 },
    otherCosts: { type: Number, default: 0, min: 0 },
    totalLandedCost: { type: Number, required: true, default: 0, min: 0 },
    allocationMethod: {
      type: String,
      enum: ['BY_QUANTITY', 'BY_VALUE', 'BY_WEIGHT', 'BY_VOLUME', 'EQUAL'],
      default: 'BY_VALUE',
    },
    items: [LandedCostItemSchema],
    status: {
      type: String,
      enum: ['DRAFT', 'APPLIED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    appliedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    appliedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const LandedCostAllocation =
  mongoose.models.LandedCostAllocation ||
  mongoose.model<ILandedCostAllocation>('LandedCostAllocation', LandedCostAllocationSchema);
