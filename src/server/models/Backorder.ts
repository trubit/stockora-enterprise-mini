import mongoose, { Schema, type Document } from 'mongoose';

export interface IBackorder extends Document {
  tenantId: string;
  companyId: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  customerId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  sku: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  backorderQuantity: number;
  warehouseId?: mongoose.Types.ObjectId;
  status: 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED';
  estimatedFulfillmentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BackorderSchema = new Schema<IBackorder>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    orderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true },
    requestedQuantity: { type: Number, required: true, min: 1 },
    allocatedQuantity: { type: Number, required: true, default: 0, min: 0 },
    backorderQuantity: { type: Number, required: true, min: 1 },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    status: {
      type: String,
      enum: ['PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    estimatedFulfillmentDate: { type: Date },
  },
  { timestamps: true }
);

export const Backorder = mongoose.model<IBackorder>('Backorder', BackorderSchema);
