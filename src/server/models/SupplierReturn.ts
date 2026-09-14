import mongoose, { Schema, type Document } from 'mongoose';

export type SupplierReturnStatus =
  | 'DRAFT'
  | 'PENDING_SUPPLIER_APPROVAL'
  | 'APPROVED'
  | 'SHIPPED'
  | 'CREDITED'
  | 'REJECTED'
  | 'CANCELLED';

export interface ISupplierReturnItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  unitCost: number;
  reason: string;
}

export interface ISupplierReturn extends Document {
  tenantId?: string;
  returnNumber: string;
  supplierId: mongoose.Types.ObjectId;
  grnId?: mongoose.Types.ObjectId;
  poId?: mongoose.Types.ObjectId;
  items: ISupplierReturnItem[];
  totalAmount: number;
  status: SupplierReturnStatus;
  creditNoteNumber?: string;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierReturnItemSchema = new Schema<ISupplierReturnItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitCost: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true },
});

const SupplierReturnSchema = new Schema<ISupplierReturn>(
  {
    tenantId: { type: String, index: true },
    returnNumber: { type: String, required: true, unique: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    grnId: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt', index: true },
    poId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
    items: [SupplierReturnItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_SUPPLIER_APPROVAL',
        'APPROVED',
        'SHIPPED',
        'CREDITED',
        'REJECTED',
        'CANCELLED',
      ],
      default: 'DRAFT',
      index: true,
    },
    creditNoteNumber: { type: String },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SupplierReturn =
  mongoose.models.SupplierReturn ||
  mongoose.model<ISupplierReturn>('SupplierReturn', SupplierReturnSchema);
