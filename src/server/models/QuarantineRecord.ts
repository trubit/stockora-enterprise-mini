import mongoose, { Schema, type Document } from 'mongoose';

export type QuarantineStatus = 'QUARANTINED' | 'RELEASED' | 'SCRAPPED' | 'RETURNED_TO_SUPPLIER';

export interface IQuarantineRecord extends Document {
  tenantId?: string;
  quarantineNumber: string;
  inspectionId?: mongoose.Types.ObjectId;
  grnId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  quantity: number;
  reason: string;
  status: QuarantineStatus;
  resolutionNotes?: string;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuarantineRecordSchema = new Schema<IQuarantineRecord>(
  {
    tenantId: { type: String, index: true },
    quarantineNumber: { type: String, required: true, unique: true, index: true },
    inspectionId: { type: Schema.Types.ObjectId, ref: 'QualityInspection', index: true },
    grnId: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['QUARANTINED', 'RELEASED', 'SCRAPPED', 'RETURNED_TO_SUPPLIER'],
      default: 'QUARANTINED',
      index: true,
    },
    resolutionNotes: { type: String },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

export const QuarantineRecord =
  mongoose.models.QuarantineRecord ||
  mongoose.model<IQuarantineRecord>('QuarantineRecord', QuarantineRecordSchema);
