import mongoose, { Schema, type Document } from 'mongoose';

export interface ISupplierPriceHistory extends Document {
  tenantId?: string;
  supplierId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  supplierSku?: string;
  previousPrice: number;
  newPrice: number;
  currency: string;
  changeReason?: string;
  effectiveDate: Date;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SupplierPriceHistorySchema = new Schema<ISupplierPriceHistory>(
  {
    tenantId: { type: String, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    supplierSku: { type: String, trim: true },
    previousPrice: { type: Number, required: true, min: 0 },
    newPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD', uppercase: true, trim: true },
    changeReason: { type: String, trim: true },
    effectiveDate: { type: Date, default: Date.now, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SupplierPriceHistory =
  mongoose.models.SupplierPriceHistory ||
  mongoose.model<ISupplierPriceHistory>('SupplierPriceHistory', SupplierPriceHistorySchema);
