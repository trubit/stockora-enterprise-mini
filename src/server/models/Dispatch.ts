import mongoose, { Schema, type Document } from 'mongoose';

export interface IDispatchPackageRef {
  packageId: mongoose.Types.ObjectId;
  packageNumber: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  trackingNumber?: string;
  weight?: number;
}

export interface IDispatch extends Document {
  dispatchNumber: string;
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  carrier: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  packages: IDispatchPackageRef[];
  totalPackages: number;
  totalWeight: number;
  status: 'PREPARING' | 'VERIFIED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  dispatchedAt?: Date;
  idempotencyKey?: string;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DispatchPackageRefSchema = new Schema<IDispatchPackageRef>(
  {
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    packageNumber: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, required: true },
    orderNumber: { type: String, required: true },
    trackingNumber: { type: String },
    weight: { type: Number },
  },
  { _id: false }
);

const DispatchSchema = new Schema<IDispatch>(
  {
    dispatchNumber: { type: String, required: true, unique: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    carrier: { type: String, required: true, trim: true },
    driverName: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    vehicleNumber: { type: String, trim: true },
    packages: [DispatchPackageRefSchema],
    totalPackages: { type: Number, default: 0 },
    totalWeight: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['PREPARING', 'VERIFIED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'],
      default: 'PREPARING',
      index: true,
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    dispatchedAt: { type: Date },
    idempotencyKey: { type: String, index: true, sparse: true },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Dispatch = mongoose.model<IDispatch>('Dispatch', DispatchSchema);
