import mongoose, { Schema, type Document } from 'mongoose';

export interface IInventoryAllocationItem {
  productId: mongoose.Types.ObjectId;
  quantityRequired: number;
  quantityAllocated: number;
  locationId?: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  lotNumber?: string;
  expiryDate?: Date;
  serialNumbers?: string[];
}

export interface IInventoryAllocation extends Document {
  allocationNumber: string;
  companyId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  orderType: 'OMNICHANNEL' | 'POS' | 'SALES_ORDER' | 'TRANSFER';
  status: 'PENDING' | 'PARTIAL' | 'ALLOCATED' | 'PICKING' | 'RELEASED' | 'CANCELLED';
  items: IInventoryAllocationItem[];
  /** Strategy used for warehouse selection */
  allocationStrategy: 'NEAREST' | 'AVAILABILITY' | 'PRIORITY' | 'ZONE' | 'MANUAL';
  warehouseIds: mongoose.Types.ObjectId[];
  allocatedAt?: Date;
  releasedAt?: Date;
  expiresAt?: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AllocationItemSchema = new Schema<IInventoryAllocationItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantityRequired: { type: Number, required: true, min: 1 },
    quantityAllocated: { type: Number, default: 0, min: 0 },
    locationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    lotNumber: { type: String },
    expiryDate: { type: Date },
    serialNumbers: [{ type: String }],
  },
  { _id: false }
);

const InventoryAllocationSchema = new Schema<IInventoryAllocation>(
  {
    allocationNumber: { type: String, required: true, unique: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    orderType: {
      type: String,
      enum: ['OMNICHANNEL', 'POS', 'SALES_ORDER', 'TRANSFER'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'ALLOCATED', 'PICKING', 'RELEASED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    items: [AllocationItemSchema],
    allocationStrategy: {
      type: String,
      enum: ['NEAREST', 'AVAILABILITY', 'PRIORITY', 'ZONE', 'MANUAL'],
      default: 'AVAILABILITY',
    },
    warehouseIds: [{ type: Schema.Types.ObjectId, ref: 'Warehouse' }],
    allocatedAt: { type: Date },
    releasedAt: { type: Date },
    expiresAt: { type: Date, index: true },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

InventoryAllocationSchema.index({ orderId: 1, status: 1 });

export const InventoryAllocation = mongoose.model<IInventoryAllocation>(
  'InventoryAllocation',
  InventoryAllocationSchema
);
