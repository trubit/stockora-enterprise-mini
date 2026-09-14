import mongoose, { Schema, type Document } from 'mongoose';

export type TransferStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
export type TransferPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ITransferRecommendation extends Document {
  tenantId?: string;
  companyId?: string;
  sourceWarehouseId: mongoose.Types.ObjectId;
  sourceWarehouseName?: string;
  targetWarehouseId: mongoose.Types.ObjectId;
  targetWarehouseName?: string;
  productId: mongoose.Types.ObjectId;
  productSku?: string;
  productName?: string;
  quantity: number;
  reason: string;
  priority: TransferPriority;
  status: TransferStatus;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransferRecommendationSchema = new Schema<ITransferRecommendation>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    companyId: { type: String, index: true, default: 'default' },
    sourceWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    sourceWarehouseName: { type: String },
    targetWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    targetWarehouseName: { type: String },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productSku: { type: String, index: true },
    productName: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'APPROVED', 'REJECTED', 'EXECUTED'],
      default: 'DRAFT',
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const TransferRecommendation = mongoose.model<ITransferRecommendation>(
  'TransferRecommendation',
  TransferRecommendationSchema
);
