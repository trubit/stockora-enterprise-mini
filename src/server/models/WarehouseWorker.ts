import mongoose, { Schema, type Document } from 'mongoose';

export interface IWarehouseWorker extends Document {
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  employeeCode?: string;
  warehouseRole:
    | 'WAREHOUSE_MANAGER'
    | 'RECEIVING_OPERATOR'
    | 'PICKER'
    | 'PACKER'
    | 'INVENTORY_CONTROLLER'
    | 'DISPATCHER';
  shift?: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FLEXIBLE';
  status: 'ACTIVE' | 'ON_BREAK' | 'OFF_SHIFT' | 'INACTIVE';
  allowedZoneIds: mongoose.Types.ObjectId[];
  currentTaskId?: mongoose.Types.ObjectId;
  startDate?: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseWorkerSchema = new Schema<IWarehouseWorker>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeCode: { type: String, trim: true },
    warehouseRole: {
      type: String,
      enum: [
        'WAREHOUSE_MANAGER',
        'RECEIVING_OPERATOR',
        'PICKER',
        'PACKER',
        'INVENTORY_CONTROLLER',
        'DISPATCHER',
      ],
      required: true,
    },
    shift: {
      type: String,
      enum: ['MORNING', 'AFTERNOON', 'NIGHT', 'FLEXIBLE'],
      default: 'FLEXIBLE',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ON_BREAK', 'OFF_SHIFT', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    allowedZoneIds: [{ type: Schema.Types.ObjectId, ref: 'WarehouseZone' }],
    currentTaskId: { type: Schema.Types.ObjectId, ref: 'WarehouseTask' },
    startDate: { type: Date },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

WarehouseWorkerSchema.index({ warehouseId: 1, userId: 1 }, { unique: true });

export const WarehouseWorker = mongoose.model<IWarehouseWorker>(
  'WarehouseWorker',
  WarehouseWorkerSchema
);
