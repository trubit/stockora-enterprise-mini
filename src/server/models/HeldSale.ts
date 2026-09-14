import mongoose, { Schema, type Document } from 'mongoose';

export interface IHeldSaleItem {
  productId: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  quantity: number;
  priceTier?: 'RETAIL' | 'WHOLESALE';
  unitPrice: number;
  discount: number;
  total: number;
}

export interface IHeldSale extends Document {
  holdId: string;
  cashierId: string;
  cashierName: string;
  branchId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  cartItems: IHeldSaleItem[];
  subtotal: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HeldSaleItemSchema = new Schema<IHeldSaleItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  priceTier: { type: String, enum: ['RETAIL', 'WHOLESALE'], default: 'RETAIL' },
  unitPrice: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true, min: 0 },
});

const HeldSaleSchema = new Schema<IHeldSale>(
  {
    holdId: { type: String, required: true, unique: true, index: true },
    cashierId: { type: String, required: true, index: true },
    cashierName: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String },
    cartItems: [HeldSaleItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

export const HeldSale = mongoose.model<IHeldSale>('HeldSale', HeldSaleSchema);
