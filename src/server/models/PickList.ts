import mongoose, { Schema, type Document } from 'mongoose';

export interface IPickItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  name?: string;
  locationId?: mongoose.Types.ObjectId;
  locationCode?: string;
  quantityRequired?: number;
  requestedQuantity?: number;
  quantityPicked: number;
  quantityShort?: number;
  lotNumber?: string;
  expiryDate?: Date;
  serialNumber?: string;
  status: 'PENDING' | 'PARTIAL' | 'PARTIALLY_PICKED' | 'PICKED' | 'SHORT' | 'SKIPPED';
  shortReason?: string;
  pickedAt?: Date;
  scannedSku?: string;
  scannedLocationCode?: string;
}

export interface IPickList extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  pickListNumber: string;
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  allocationId?: mongoose.Types.ObjectId;
  waveId?: mongoose.Types.ObjectId;
  strategy?: string;
  pickingStrategy?: 'SINGLE_ORDER' | 'SINGLE' | 'BATCH' | 'ZONE' | 'WAVE';
  status:
    | 'PENDING'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'PARTIAL'
    | 'PARTIALLY_PICKED'
    | 'PICKED'
    | 'COMPLETED'
    | 'EXCEPTION'
    | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assignedTo?: mongoose.Types.ObjectId;
  assignedPickerId?: mongoose.Types.ObjectId;
  assignedPickerName?: string;
  items: IPickItem[];
  totalItems?: number;
  totalPicked?: number;
  totalShort?: number;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  idempotencyKey?: string;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PickItemSchema = new Schema<IPickItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String },
    name: { type: String },
    locationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    locationCode: { type: String },
    quantityRequired: { type: Number, min: 0 },
    requestedQuantity: { type: Number, min: 0 },
    quantityPicked: { type: Number, default: 0, min: 0 },
    quantityShort: { type: Number, default: 0, min: 0 },
    lotNumber: { type: String },
    expiryDate: { type: Date },
    serialNumber: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'PARTIALLY_PICKED', 'PICKED', 'SHORT', 'SKIPPED'],
      default: 'PENDING',
    },
    shortReason: { type: String },
    pickedAt: { type: Date },
    scannedSku: { type: String },
    scannedLocationCode: { type: String },
  },
  { _id: true }
);

const PickListSchema = new Schema<IPickList>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    pickListNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: Schema.Types.ObjectId, index: true },
    orderNumber: { type: String, index: true },
    allocationId: { type: Schema.Types.ObjectId, ref: 'InventoryAllocation' },
    waveId: { type: Schema.Types.ObjectId, ref: 'PickingWave' },
    strategy: { type: String, default: 'SINGLE' },
    pickingStrategy: {
      type: String,
      enum: ['SINGLE_ORDER', 'SINGLE', 'BATCH', 'ZONE', 'WAVE'],
      default: 'SINGLE',
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'ASSIGNED',
        'IN_PROGRESS',
        'PARTIAL',
        'PARTIALLY_PICKED',
        'PICKED',
        'COMPLETED',
        'EXCEPTION',
        'CANCELLED',
      ],
      default: 'ASSIGNED',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedPickerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedPickerName: { type: String },
    items: [PickItemSchema],
    totalItems: { type: Number, default: 0 },
    totalPicked: { type: Number, default: 0 },
    totalShort: { type: Number, default: 0 },
    assignedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    idempotencyKey: { type: String, index: true, sparse: true },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const PickList =
  mongoose.models.PickList || mongoose.model<IPickList>('PickList', PickListSchema);
