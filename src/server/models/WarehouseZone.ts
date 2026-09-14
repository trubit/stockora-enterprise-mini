import mongoose, { Schema, type Document } from 'mongoose';

export type ZoneType =
  | 'RECEIVING'
  | 'STORAGE'
  | 'PICKING'
  | 'PACKING'
  | 'QUARANTINE'
  | 'DAMAGED'
  | 'RETURNS'
  | 'DISPATCH'
  | 'TRANSIT'
  | 'COLD_STORAGE'
  | 'HAZMAT';

export interface IWarehouseZone extends Document {
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  zoneType: ZoneType;
  description?: string;
  temperatureMin?: number; // °C
  temperatureMax?: number; // °C
  capacityUnits?: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseZoneSchema = new Schema<IWarehouseZone>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    zoneType: {
      type: String,
      enum: [
        'RECEIVING',
        'STORAGE',
        'PICKING',
        'PACKING',
        'QUARANTINE',
        'DAMAGED',
        'RETURNS',
        'DISPATCH',
        'TRANSIT',
        'COLD_STORAGE',
        'HAZMAT',
      ],
      default: 'STORAGE',
    },
    description: { type: String },
    temperatureMin: { type: Number },
    temperatureMax: { type: Number },
    capacityUnits: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

WarehouseZoneSchema.index({ warehouseId: 1, code: 1 }, { unique: true });

export const WarehouseZone = mongoose.model<IWarehouseZone>('WarehouseZone', WarehouseZoneSchema);
