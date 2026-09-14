import mongoose, { Schema, type Document } from 'mongoose';

export type WarehouseType =
  | 'MAIN'
  | 'RETAIL'
  | 'DISTRIBUTION'
  | 'FULFILLMENT'
  | 'COLD_STORAGE'
  | 'TRANSIT'
  | 'RETURN'
  | 'QUARANTINE'
  | 'DISTRIBUTION_CENTER'
  | 'RETAIL_STORE'
  | 'FULFILLMENT_CENTER'
  | 'RETURNS_CENTER';

export interface IOperatingHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface IWarehouse extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  name: string;
  code: string;
  warehouseType: WarehouseType;
  address?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  managerId?: mongoose.Types.ObjectId;
  timezone: string;
  operatingHours: IOperatingHours[];
  capacityUnits?: number;
  capacityWeight?: number;
  capacityVolume?: number;
  currentUnitsUsed?: number;
  currentWeightUsed?: number;
  currentVolumeUsed?: number;
  receivingSettings?: {
    overReceivingTolerancePercent?: number;
    autoPutawayEnabled?: boolean;
  };
  pickingSettings?: {
    defaultStrategy?: 'SINGLE' | 'BATCH' | 'WAVE' | 'ZONE';
    fefoEnabled?: boolean;
    fifoEnabled?: boolean;
  };
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OperatingHoursSchema = new Schema<IOperatingHours>(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    openTime: { type: String, default: '08:00' },
    closeTime: { type: String, default: '18:00' },
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const WarehouseSchema = new Schema<IWarehouse>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    warehouseType: {
      type: String,
      enum: [
        'MAIN',
        'RETAIL',
        'DISTRIBUTION',
        'FULFILLMENT',
        'COLD_STORAGE',
        'TRANSIT',
        'RETURN',
        'QUARANTINE',
        'DISTRIBUTION_CENTER',
        'RETAIL_STORE',
        'FULFILLMENT_CENTER',
        'RETURNS_CENTER',
      ],
      default: 'MAIN',
    },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'User' },
    timezone: { type: String, default: 'UTC' },
    operatingHours: { type: [OperatingHoursSchema], default: [] },
    capacityUnits: { type: Number, min: 0, default: 10000 },
    capacityWeight: { type: Number, min: 0, default: 50000 },
    capacityVolume: { type: Number, min: 0, default: 5000 },
    currentUnitsUsed: { type: Number, min: 0, default: 0 },
    currentWeightUsed: { type: Number, min: 0, default: 0 },
    currentVolumeUsed: { type: Number, min: 0, default: 0 },
    receivingSettings: {
      overReceivingTolerancePercent: { type: Number, default: 5 },
      autoPutawayEnabled: { type: Boolean, default: true },
    },
    pickingSettings: {
      defaultStrategy: {
        type: String,
        enum: ['SINGLE', 'BATCH', 'WAVE', 'ZONE'],
        default: 'SINGLE',
      },
      fefoEnabled: { type: Boolean, default: true },
      fifoEnabled: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Warehouse =
  mongoose.models.Warehouse || mongoose.model<IWarehouse>('Warehouse', WarehouseSchema);
