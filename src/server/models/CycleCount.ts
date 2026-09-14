import mongoose, { Schema, type Document } from 'mongoose';

export type CountType =
  'FULL' | 'CYCLE' | 'BLIND' | 'LOCATION' | 'SCHEDULED' | 'RANDOM' | 'ABC' | 'PRODUCT';

export interface ICycleCountItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  name?: string;
  locationId?: mongoose.Types.ObjectId;
  locationCode?: string;
  lotNumber?: string;
  serialNumber?: string;
  expectedQuantity?: number;
  systemQuantity?: number;
  countedQuantity?: number;
  variance?: number;
  varianceValue?: number;
  unitCost?: number;
  status: 'PENDING' | 'COUNTED' | 'VERIFIED' | 'ADJUSTED' | 'REJECTED';
  countedAt?: Date;
  counterId?: mongoose.Types.ObjectId;
  notes?: string;
}

export interface ICycleCount extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  countNumber: string;
  warehouseId: mongoose.Types.ObjectId;
  countType: CountType;
  zoneId?: mongoose.Types.ObjectId;
  isBlindCount: boolean;
  status:
    | 'DRAFT'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'REVIEW_REQUIRED'
    | 'VARIANCE_DETECTED'
    | 'APPROVED'
    | 'COMPLETED'
    | 'CANCELLED';
  assignedCounterId?: mongoose.Types.ObjectId;
  assignedCounterName?: string;
  items: ICycleCountItem[];
  totalExpectedItems?: number;
  totalCountedItems?: number;
  totalVarianceCount?: number;
  totalVarianceValue?: number;
  approvalRequired?: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CycleCountItemSchema = new Schema<ICycleCountItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String },
    name: { type: String },
    locationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    locationCode: { type: String },
    lotNumber: { type: String },
    serialNumber: { type: String },
    expectedQuantity: { type: Number, min: 0, default: 0 },
    systemQuantity: { type: Number, min: 0, default: 0 },
    countedQuantity: { type: Number, min: 0, default: 0 },
    variance: { type: Number, default: 0 },
    varianceValue: { type: Number, default: 0 },
    unitCost: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'COUNTED', 'VERIFIED', 'ADJUSTED', 'REJECTED'],
      default: 'PENDING',
    },
    countedAt: { type: Date },
    counterId: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
  },
  { _id: true }
);

const CycleCountSchema = new Schema<ICycleCount>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    countNumber: { type: String, required: true, unique: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    countType: {
      type: String,
      enum: ['FULL', 'CYCLE', 'BLIND', 'LOCATION', 'SCHEDULED', 'RANDOM', 'ABC', 'PRODUCT'],
      default: 'CYCLE',
    },
    zoneId: { type: Schema.Types.ObjectId, ref: 'WarehouseZone' },
    isBlindCount: { type: Boolean, default: true },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'ASSIGNED',
        'IN_PROGRESS',
        'REVIEW_REQUIRED',
        'VARIANCE_DETECTED',
        'APPROVED',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'IN_PROGRESS',
      index: true,
    },
    assignedCounterId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedCounterName: { type: String },
    items: [CycleCountItemSchema],
    totalExpectedItems: { type: Number, default: 0 },
    totalCountedItems: { type: Number, default: 0 },
    totalVarianceCount: { type: Number, default: 0 },
    totalVarianceValue: { type: Number, default: 0 },
    approvalRequired: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const CycleCount =
  mongoose.models.CycleCount || mongoose.model<ICycleCount>('CycleCount', CycleCountSchema);
