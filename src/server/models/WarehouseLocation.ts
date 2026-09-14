import mongoose, { Schema, type Document } from 'mongoose';

export type LocationType =
  | 'RECEIVING'
  | 'STORAGE'
  | 'PICKING'
  | 'PACKING'
  | 'DISPATCH'
  | 'QUARANTINE'
  | 'DAMAGED'
  | 'RETURNS'
  | 'STAGING'
  | 'TRANSIT';

export interface IWarehouseLocation extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  zoneId?: mongoose.Types.ObjectId;
  locationCode: string;
  label?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  locationType: LocationType;
  capacityUnits?: number;
  capacityWeight?: number;
  capacityVolume?: number;
  currentUnits: number;
  currentWeight: number;
  currentVolume: number;
  pickSequencePriority?: number;
  isActive: boolean;
  isRestricted: boolean;
  allowedProductIds?: mongoose.Types.ObjectId[];
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseLocationSchema = new Schema<IWarehouseLocation>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'WarehouseZone', index: true },
    locationCode: { type: String, required: true, uppercase: true, trim: true },
    label: { type: String, trim: true },
    aisle: { type: String, trim: true, index: true },
    rack: { type: String, trim: true },
    shelf: { type: String, trim: true },
    bin: { type: String, trim: true },
    locationType: {
      type: String,
      enum: [
        'RECEIVING',
        'STORAGE',
        'PICKING',
        'PACKING',
        'DISPATCH',
        'QUARANTINE',
        'DAMAGED',
        'RETURNS',
        'STAGING',
        'TRANSIT',
      ],
      default: 'STORAGE',
      index: true,
    },
    capacityUnits: { type: Number, min: 0, default: 500 },
    capacityWeight: { type: Number, min: 0, default: 2000 },
    capacityVolume: { type: Number, min: 0, default: 500 },
    currentUnits: { type: Number, default: 0, min: 0 },
    currentWeight: { type: Number, default: 0, min: 0 },
    currentVolume: { type: Number, default: 0, min: 0 },
    pickSequencePriority: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true, index: true },
    isRestricted: { type: Boolean, default: false },
    allowedProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const WarehouseLocation =
  mongoose.models.WarehouseLocation ||
  mongoose.model<IWarehouseLocation>('WarehouseLocation', WarehouseLocationSchema);
