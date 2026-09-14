import mongoose, { Schema, type Document } from 'mongoose';

export type SupplierInvoiceMatchingStatus =
  | 'UNMATCHED'
  | 'MATCHED'
  | 'EXCEPTION_QTY_MISMATCH'
  | 'EXCEPTION_PRICE_MISMATCH'
  | 'EXCEPTION_MISSING_RECEIPT'
  | 'APPROVED_EXCEPTION';

export interface ISupplierInvoice extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  invoiceNumber: string;
  poId: mongoose.Types.ObjectId;
  poNumber?: string;
  grnId?: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  supplierName?: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  amount: number;
  currency: string;
  invoiceDate: Date;
  dueDate: Date;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  matchingStatus: SupplierInvoiceMatchingStatus;
  paymentTerms: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierInvoiceSchema = new Schema<ISupplierInvoice>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    poId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
    poNumber: { type: String },
    grnId: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt', index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    supplierName: { type: String },
    subtotal: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    shippingAmount: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true, trim: true },
    invoiceDate: { type: Date, default: Date.now, required: true },
    dueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'UNPAID',
      required: true,
      index: true,
    },
    matchingStatus: {
      type: String,
      enum: [
        'UNMATCHED',
        'MATCHED',
        'EXCEPTION_QTY_MISMATCH',
        'EXCEPTION_PRICE_MISMATCH',
        'EXCEPTION_MISSING_RECEIPT',
        'APPROVED_EXCEPTION',
      ],
      default: 'UNMATCHED',
      index: true,
    },
    paymentTerms: { type: String, required: true, default: 'NET 30' },
    notes: { type: String },
  },
  { timestamps: true }
);

SupplierInvoiceSchema.index({ tenantId: 1, supplierId: 1, invoiceNumber: 1 }, { unique: true });

export const SupplierInvoice =
  mongoose.models.SupplierInvoice ||
  mongoose.model<ISupplierInvoice>('SupplierInvoice', SupplierInvoiceSchema);
