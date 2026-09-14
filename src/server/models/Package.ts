import mongoose, { Schema, type Document } from 'mongoose';

export interface IPackageItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  name?: string;
  quantity: number;
  lotNumber?: string;
  serialNumber?: string;
}

export interface IPackage extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  packageNumber: string;
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  packingStationId?: mongoose.Types.ObjectId;
  packerId?: mongoose.Types.ObjectId;
  items: IPackageItem[];
  packagingType?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  length?: number;
  width?: number;
  height?: number;
  carrier?: string;
  shippingMethod?: string;
  trackingNumber?: string;
  shippingLabelUrl?: string;
  status:
    'PACKING' | 'PACKED' | 'LABEL_GENERATED' | 'READY_FOR_DISPATCH' | 'DISPATCHED' | 'CANCELLED';
  packedAt?: Date;
  dispatchedAt?: Date;
  idempotencyKey?: string;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PackageItemSchema = new Schema<IPackageItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String },
    name: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    lotNumber: { type: String },
    serialNumber: { type: String },
  },
  { _id: false }
);

const PackageSchema = new Schema<IPackage>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    packageNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'OmnichannelOrder', index: true },
    orderNumber: { type: String, index: true },
    packingStationId: { type: Schema.Types.ObjectId, ref: 'PackingStation' },
    packerId: { type: Schema.Types.ObjectId, ref: 'User' },
    items: [PackageItemSchema],
    packagingType: { type: String, default: 'BOX_MED' },
    weight: { type: Number, min: 0 },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
    },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    carrier: { type: String, trim: true },
    shippingMethod: { type: String, trim: true },
    trackingNumber: { type: String, trim: true, index: true },
    shippingLabelUrl: { type: String },
    status: {
      type: String,
      enum: [
        'PACKING',
        'PACKED',
        'LABEL_GENERATED',
        'READY_FOR_DISPATCH',
        'DISPATCHED',
        'CANCELLED',
      ],
      default: 'PACKED',
      index: true,
    },
    packedAt: { type: Date },
    dispatchedAt: { type: Date },
    idempotencyKey: { type: String, index: true, sparse: true },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Package =
  mongoose.models.Package || mongoose.model<IPackage>('Package', PackageSchema);
