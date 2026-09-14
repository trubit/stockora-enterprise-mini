import mongoose, { Schema, type Document } from 'mongoose';

export type ManifestStatus =
  'DRAFT' | 'READY' | 'LOADED' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';

export interface IDispatchManifestItem {
  packageId?: mongoose.Types.ObjectId;
  packageNumber: string;
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  recipientName?: string;
  destinationCity?: string;
  weight?: number;
  isVerifiedLoaded: boolean;
}

export interface IDispatchManifest extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  manifestNumber: string;
  carrierName: string;
  carrierCode?: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlateNumber?: string;
  items: IDispatchManifestItem[];
  totalPackages: number;
  totalWeight?: number;
  status: ManifestStatus;
  dispatchedBy?: mongoose.Types.ObjectId;
  dispatchedByName?: string;
  dispatchedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DispatchManifestItemSchema = new Schema<IDispatchManifestItem>({
  packageId: { type: Schema.Types.ObjectId, ref: 'Package' },
  packageNumber: { type: String, required: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'OmnichannelOrder' },
  orderNumber: { type: String },
  recipientName: { type: String },
  destinationCity: { type: String },
  weight: { type: Number, default: 0 },
  isVerifiedLoaded: { type: Boolean, default: false },
});

const DispatchManifestSchema = new Schema<IDispatchManifest>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    manifestNumber: { type: String, required: true, unique: true, index: true },
    carrierName: { type: String, required: true },
    carrierCode: { type: String },
    driverName: { type: String },
    driverPhone: { type: String },
    vehiclePlateNumber: { type: String },
    items: [DispatchManifestItemSchema],
    totalPackages: { type: Number, default: 0 },
    totalWeight: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'READY', 'LOADED', 'DISPATCHED', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    dispatchedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    dispatchedByName: { type: String },
    dispatchedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const DispatchManifest =
  mongoose.models.DispatchManifest ||
  mongoose.model<IDispatchManifest>('DispatchManifest', DispatchManifestSchema);
