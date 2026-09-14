import mongoose, { Schema, type Document } from 'mongoose';

export interface IProcurementMatch extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  poId: mongoose.Types.ObjectId;
  grnId?: mongoose.Types.ObjectId;
  priceVariance: number;
  quantityVariance: number;
  taxVariance: number;
  deliveryVarianceDays: number;
  overallStatus:
    | 'MATCHED'
    | 'PRICE_VARIANCE'
    | 'QUANTITY_VARIANCE'
    | 'TAX_VARIANCE'
    | 'MISSING_RECEIPT'
    | 'MANUAL_REVIEW';
  isApprovedForPayment: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedByName?: string;
  matchedBy?: mongoose.Types.ObjectId;
  matchedAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProcurementMatchSchema = new Schema<IProcurementMatch>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierInvoice',
      required: true,
      index: true,
    },
    poId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
    grnId: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt', index: true },
    priceVariance: { type: Number, default: 0 },
    quantityVariance: { type: Number, default: 0 },
    taxVariance: { type: Number, default: 0 },
    deliveryVarianceDays: { type: Number, default: 0 },
    overallStatus: {
      type: String,
      enum: [
        'MATCHED',
        'PRICE_VARIANCE',
        'QUANTITY_VARIANCE',
        'TAX_VARIANCE',
        'MISSING_RECEIPT',
        'MANUAL_REVIEW',
      ],
      required: true,
      index: true,
    },
    isApprovedForPayment: { type: Boolean, default: false, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String },
    matchedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    matchedAt: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { timestamps: true }
);

export const ProcurementMatch =
  mongoose.models.ProcurementMatch ||
  mongoose.model<IProcurementMatch>('ProcurementMatch', ProcurementMatchSchema);
