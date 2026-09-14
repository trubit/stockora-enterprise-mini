import mongoose, { Schema, type Document } from 'mongoose';

export interface IPriceListItem extends Document {
  priceListId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  sku?: string;
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const PriceListItemSchema = new Schema<IPriceListItem>(
  {
    priceListId: { type: Schema.Types.ObjectId, ref: 'PriceList', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, trim: true },
    minQuantity: { type: Number, required: true, default: 1, min: 1 },
    maxQuantity: { type: Number, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD', uppercase: true },
  },
  { timestamps: true }
);

PriceListItemSchema.index({ priceListId: 1, productId: 1, minQuantity: 1 });

export const PriceListItem = mongoose.model<IPriceListItem>('PriceListItem', PriceListItemSchema);
