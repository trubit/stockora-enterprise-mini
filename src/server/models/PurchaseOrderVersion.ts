import mongoose, { Schema, type Document } from 'mongoose';

export interface IPurchaseOrderVersionItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  name?: string;
  quantity: number;
  costPrice: number;
}

export interface IPurchaseOrderVersion extends Document {
  tenantId?: string;
  poId: mongoose.Types.ObjectId;
  version: number;
  poNumber: string;
  items: IPurchaseOrderVersionItem[];
  totalAmount: number;
  changeSummary: string;
  amendedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PurchaseOrderVersionItemSchema = new Schema<IPurchaseOrderVersionItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String },
  name: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  costPrice: { type: Number, required: true, min: 0 },
});

const PurchaseOrderVersionSchema = new Schema<IPurchaseOrderVersion>(
  {
    tenantId: { type: String, index: true },
    poId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    poNumber: { type: String, required: true, index: true },
    items: [PurchaseOrderVersionItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    changeSummary: { type: String, required: true },
    amendedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

PurchaseOrderVersionSchema.index({ poId: 1, version: 1 }, { unique: true });

export const PurchaseOrderVersion =
  mongoose.models.PurchaseOrderVersion ||
  mongoose.model<IPurchaseOrderVersion>('PurchaseOrderVersion', PurchaseOrderVersionSchema);
