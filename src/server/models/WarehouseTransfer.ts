import mongoose, { Schema, type Document } from 'mongoose';

export interface IWarehouseTransferItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  name?: string;
  quantity: number;
  shippedQuantity?: number;
  receivedQuantity?: number;
  fromLocationId?: mongoose.Types.ObjectId;
  toLocationId?: mongoose.Types.ObjectId;
  lotNumber?: string;
  expiryDate?: Date;
  serialNumber?: string;
}

export type TransferStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'REQUESTED'
  | 'APPROVED'
  | 'PICKING'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface IWarehouseTransfer extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  transferNumber: string;
  fromWarehouseId: mongoose.Types.ObjectId;
  toWarehouseId: mongoose.Types.ObjectId;
  items: IWarehouseTransferItem[];
  status: TransferStatus;
  requestedBy?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  shippedBy?: mongoose.Types.ObjectId;
  shippedAt?: Date;
  receivedBy?: mongoose.Types.ObjectId;
  receivedAt?: Date;
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  idempotencyKey?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseTransferItemSchema = new Schema<IWarehouseTransferItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String },
    name: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    shippedQuantity: { type: Number, default: 0, min: 0 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    fromLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    toLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    lotNumber: { type: String },
    expiryDate: { type: Date },
    serialNumber: { type: String },
  },
  { _id: false }
);

const WarehouseTransferSchema = new Schema<IWarehouseTransfer>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    transferNumber: { type: String, required: true, unique: true, index: true },
    fromWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    toWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    items: [WarehouseTransferItemSchema],
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING',
        'REQUESTED',
        'APPROVED',
        'PICKING',
        'DISPATCHED',
        'IN_TRANSIT',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'CANCELLED',
        'COMPLETED',
      ],
      default: 'REQUESTED',
      required: true,
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    shippedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    shippedAt: { type: Date },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    receivedAt: { type: Date },
    trackingNumber: { type: String },
    carrier: { type: String },
    notes: { type: String },
    idempotencyKey: { type: String, index: true, sparse: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const WarehouseTransfer =
  mongoose.models.WarehouseTransfer ||
  mongoose.model<IWarehouseTransfer>('WarehouseTransfer', WarehouseTransferSchema);
