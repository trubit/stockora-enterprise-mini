import mongoose, { Schema, type Document } from 'mongoose';

export interface IPackingStation extends Document {
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  stationCode: string;
  name: string;
  locationId?: mongoose.Types.ObjectId;
  assignedPackerId?: mongoose.Types.ObjectId;
  assignedPackerName?: string;
  isActive: boolean;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PackingStationSchema = new Schema<IPackingStation>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    stationCode: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    assignedPackerId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedPackerName: { type: String },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

PackingStationSchema.index({ warehouseId: 1, stationCode: 1 }, { unique: true });

export const PackingStation = mongoose.model<IPackingStation>(
  'PackingStation',
  PackingStationSchema
);
