import mongoose, { Schema, type Document } from 'mongoose';

export type InspectionResultStatus =
  'ACCEPTED' | 'REJECTED' | 'DAMAGED' | 'DEFECTIVE' | 'QUARANTINED' | 'PENDING';

export interface IQualityInspectionItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  quantityInspected: number;
  quantityPassed: number;
  quantityFailed: number;
  defectType?: string;
  failureReason?: string;
  resultStatus: InspectionResultStatus;
}

export interface IQualityInspection extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  inspectionNumber: string;
  grnId: mongoose.Types.ObjectId;
  grnNumber?: string;
  poId: mongoose.Types.ObjectId;
  poNumber?: string;
  items: IQualityInspectionItem[];
  overallStatus: InspectionResultStatus;
  inspectorId: mongoose.Types.ObjectId;
  inspectorName?: string;
  notes?: string;
  attachments?: string[];
  inspectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QualityInspectionItemSchema = new Schema<IQualityInspectionItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String },
  quantityInspected: { type: Number, required: true, min: 0 },
  quantityPassed: { type: Number, required: true, min: 0 },
  quantityFailed: { type: Number, required: true, min: 0 },
  defectType: { type: String },
  failureReason: { type: String },
  resultStatus: {
    type: String,
    enum: ['ACCEPTED', 'REJECTED', 'DAMAGED', 'DEFECTIVE', 'QUARANTINED', 'PENDING'],
    required: true,
  },
});

const QualityInspectionSchema = new Schema<IQualityInspection>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    inspectionNumber: { type: String, required: true, unique: true, index: true },
    grnId: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt', required: true, index: true },
    grnNumber: { type: String },
    poId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
    poNumber: { type: String },
    items: [QualityInspectionItemSchema],
    overallStatus: {
      type: String,
      enum: ['ACCEPTED', 'REJECTED', 'DAMAGED', 'DEFECTIVE', 'QUARANTINED', 'PENDING'],
      default: 'PENDING',
      index: true,
    },
    inspectorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inspectorName: { type: String },
    notes: { type: String },
    attachments: [{ type: String }],
    inspectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const QualityInspection =
  mongoose.models.QualityInspection ||
  mongoose.model<IQualityInspection>('QualityInspection', QualityInspectionSchema);
