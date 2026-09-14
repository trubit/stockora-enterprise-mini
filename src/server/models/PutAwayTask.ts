import mongoose, { Schema, type Document } from 'mongoose';

export type PutAwayStrategy =
  | 'FIXED_LOCATION'
  | 'NEAREST_AVAILABLE'
  | 'CAPACITY_BASED'
  | 'PRODUCT_CATEGORY'
  | 'FAST_MOVING'
  | 'FIFO'
  | 'FEFO';

export interface IPutAwayTask extends Document {
  taskNumber: string;
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  goodsReceiptId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  confirmedQuantity: number;
  lotNumber?: string;
  expiryDate?: Date;
  serialNumbers?: string[];
  /** Location where goods are currently sitting (e.g. RECEIVING dock) */
  sourceLocationId: mongoose.Types.ObjectId;
  /** Suggested put-away destination */
  suggestedLocationId?: mongoose.Types.ObjectId;
  /** Confirmed destination (worker may override suggestion) */
  confirmedLocationId?: mongoose.Types.ObjectId;
  strategy: PutAwayStrategy;
  /** Human-readable reason for the suggestion */
  suggestionReason?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assignedWorkerId?: mongoose.Types.ObjectId;
  assignedUserId?: mongoose.Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PutAwayTaskSchema = new Schema<IPutAwayTask>(
  {
    taskNumber: { type: String, required: true, unique: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    goodsReceiptId: {
      type: Schema.Types.ObjectId,
      ref: 'GoodsReceipt',
      required: true,
      index: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    confirmedQuantity: { type: Number, default: 0, min: 0 },
    lotNumber: { type: String, trim: true },
    expiryDate: { type: Date },
    serialNumbers: [{ type: String }],
    sourceLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation', required: true },
    suggestedLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    confirmedLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    strategy: {
      type: String,
      enum: [
        'FIXED_LOCATION',
        'NEAREST_AVAILABLE',
        'CAPACITY_BASED',
        'PRODUCT_CATEGORY',
        'FAST_MOVING',
        'FIFO',
        'FEFO',
      ],
      default: 'NEAREST_AVAILABLE',
    },
    suggestionReason: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    assignedWorkerId: { type: Schema.Types.ObjectId, ref: 'WarehouseWorker' },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

PutAwayTaskSchema.index({ warehouseId: 1, status: 1 });

export const PutAwayTask = mongoose.model<IPutAwayTask>('PutAwayTask', PutAwayTaskSchema);
