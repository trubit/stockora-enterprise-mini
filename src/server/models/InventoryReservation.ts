import mongoose, { Schema, type Document } from 'mongoose';

export interface IInventoryReservation extends Document {
  productId: mongoose.Types.ObjectId;
  sku: string;
  warehouseId: mongoose.Types.ObjectId;
  quantity: number;
  reservedForOrderNumber: string;
  channel: 'POS' | 'WEBSITE' | 'MOBILE' | 'MARKETPLACE' | 'API';
  status: 'RESERVED' | 'CONFIRMED' | 'EXPIRED' | 'RELEASED';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryReservationSchema = new Schema<IInventoryReservation>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    reservedForOrderNumber: { type: String, required: true, index: true },
    channel: {
      type: String,
      enum: ['POS', 'WEBSITE', 'MOBILE', 'MARKETPLACE', 'API'],
      required: true,
      default: 'POS',
    },
    status: {
      type: String,
      enum: ['RESERVED', 'CONFIRMED', 'EXPIRED', 'RELEASED'],
      default: 'RESERVED',
      required: true,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

export const InventoryReservation = mongoose.model<IInventoryReservation>(
  'InventoryReservation',
  InventoryReservationSchema
);
