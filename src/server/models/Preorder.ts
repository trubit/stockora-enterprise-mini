import mongoose, { Schema, type Document } from 'mongoose';

export interface IPreorder extends Document {
  tenantId: string;
  companyId: string;
  preorderNumber: string;
  customerId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  sku: string;
  quantity: number;
  unitPrice: number;
  depositAmount: number;
  totalAmount: number;
  expectedAvailabilityDate?: Date;
  status: 'PENDING' | 'DEPOSIT_PAID' | 'READY_FOR_FULFILLMENT' | 'FULFILLED' | 'CANCELLED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PreorderSchema = new Schema<IPreorder>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    preorderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    depositAmount: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    expectedAvailabilityDate: { type: Date },
    status: {
      type: String,
      enum: ['PENDING', 'DEPOSIT_PAID', 'READY_FOR_FULFILLMENT', 'FULFILLED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Preorder = mongoose.model<IPreorder>('Preorder', PreorderSchema);
