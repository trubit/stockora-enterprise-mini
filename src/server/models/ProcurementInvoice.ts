import mongoose, { Schema, type Document } from 'mongoose';

export type InvoiceMatchStatus =
  | 'UNMATCHED'
  | 'MATCHED'
  | 'PRICE_VARIANCE'
  | 'QUANTITY_VARIANCE'
  | 'TAX_VARIANCE'
  | 'MANUAL_REVIEW';

export interface IProcurementInvoiceItem {
  productId: mongoose.Types.ObjectId;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  lineTotal: number;
}

export interface IProcurementInvoice extends Document {
  tenantId?: string;
  invoiceNumber: string;
  supplierId: mongoose.Types.ObjectId;
  poId?: mongoose.Types.ObjectId;
  grnId?: mongoose.Types.ObjectId;
  items: IProcurementInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  invoiceDate: Date;
  dueDate: Date;
  matchStatus: InvoiceMatchStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProcurementInvoiceItemSchema = new Schema<IProcurementInvoiceItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  description: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
});

const ProcurementInvoiceSchema = new Schema<IProcurementInvoice>(
  {
    tenantId: { type: String, index: true },
    invoiceNumber: { type: String, required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    poId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
    grnId: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt', index: true },
    items: [ProcurementInvoiceItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    shippingAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    matchStatus: {
      type: String,
      enum: [
        'UNMATCHED',
        'MATCHED',
        'PRICE_VARIANCE',
        'QUANTITY_VARIANCE',
        'TAX_VARIANCE',
        'MANUAL_REVIEW',
      ],
      default: 'UNMATCHED',
      index: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

ProcurementInvoiceSchema.index({ supplierId: 1, invoiceNumber: 1 }, { unique: true });

export const ProcurementInvoice =
  mongoose.models.ProcurementInvoice ||
  mongoose.model<IProcurementInvoice>('ProcurementInvoice', ProcurementInvoiceSchema);
