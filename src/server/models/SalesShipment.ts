import mongoose, { Schema, type Document } from 'mongoose';

export interface ISalesShipmentItem {
  productId: mongoose.Types.ObjectId;
  quantityShipped: number;
}

export interface ISalesShipment extends Document {
  shipmentNumber: string;
  orderId: mongoose.Types.ObjectId;
  items: ISalesShipmentItem[];
  shippedAt: Date;
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  carrier?: string;
  trackingNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesShipmentItemSchema = new Schema<ISalesShipmentItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantityShipped: { type: Number, required: true, min: 1 },
});

const SalesShipmentSchema = new Schema<ISalesShipment>(
  {
    shipmentNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', required: true, index: true },
    items: [SalesShipmentItemSchema],
    shippedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    carrier: { type: String },
    trackingNumber: { type: String },
  },
  { timestamps: true }
);

export const SalesShipment = mongoose.model<ISalesShipment>('SalesShipment', SalesShipmentSchema);
