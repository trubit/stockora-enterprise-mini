import mongoose, { Schema, type Document } from 'mongoose';

export interface IPickingWave extends Document {
  waveNumber: string;
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  name?: string;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  orderIds: mongoose.Types.ObjectId[];
  pickListIds: mongoose.Types.ObjectId[];
  /** Wave grouping criteria */
  deliveryZone?: string;
  shippingMethod?: string;
  productCategory?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  plannedPickerCount?: number;
  totalOrders: number;
  completedOrders: number;
  releasedAt?: Date;
  completedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PickingWaveSchema = new Schema<IPickingWave>(
  {
    waveNumber: { type: String, required: true, unique: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    name: { type: String, trim: true },
    status: {
      type: String,
      enum: ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    orderIds: [{ type: Schema.Types.ObjectId, ref: 'OmnichannelOrder' }],
    pickListIds: [{ type: Schema.Types.ObjectId, ref: 'PickList' }],
    deliveryZone: { type: String, trim: true },
    shippingMethod: { type: String, trim: true },
    productCategory: { type: String, trim: true },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    plannedPickerCount: { type: Number, min: 1 },
    totalOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    releasedAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const PickingWave = mongoose.model<IPickingWave>('PickingWave', PickingWaveSchema);
