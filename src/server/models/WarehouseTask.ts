import mongoose, { Schema, type Document } from 'mongoose';

export type WarehouseTaskType =
  | 'PUT_AWAY'
  | 'PICK'
  | 'PACK'
  | 'TRANSFER'
  | 'CYCLE_COUNT'
  | 'RECEIVING'
  | 'REPLENISHMENT'
  | 'HOUSEKEEPING';

export type WarehouseTaskStatus =
  'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface IWarehouseTask extends Document {
  taskNumber: string;
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  taskType: WarehouseTaskType;
  status: WarehouseTaskStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assignedWorkerId?: mongoose.Types.ObjectId;
  assignedUserId?: mongoose.Types.ObjectId;
  referenceId?: string;
  referenceType?: string;
  sourceLocationId?: mongoose.Types.ObjectId;
  destinationLocationId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  quantity?: number;
  assignedAt?: Date;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  dueBy?: Date;
  notes?: string;
  failureReason?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseTaskSchema = new Schema<IWarehouseTask>(
  {
    taskNumber: { type: String, required: true, unique: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    taskType: {
      type: String,
      enum: [
        'PUT_AWAY',
        'PICK',
        'PACK',
        'TRANSFER',
        'CYCLE_COUNT',
        'RECEIVING',
        'REPLENISHMENT',
        'HOUSEKEEPING',
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
      index: true,
    },
    assignedWorkerId: { type: Schema.Types.ObjectId, ref: 'WarehouseWorker', index: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    referenceId: { type: String, index: true },
    referenceType: { type: String },
    sourceLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    destinationLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, min: 0 },
    assignedAt: { type: Date },
    startedAt: { type: Date },
    pausedAt: { type: Date },
    completedAt: { type: Date },
    dueBy: { type: Date, index: true },
    notes: { type: String },
    failureReason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

WarehouseTaskSchema.index({ warehouseId: 1, status: 1, taskType: 1 });
WarehouseTaskSchema.index({ assignedWorkerId: 1, status: 1 });

export const WarehouseTask = mongoose.model<IWarehouseTask>('WarehouseTask', WarehouseTaskSchema);
