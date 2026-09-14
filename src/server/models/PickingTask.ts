import mongoose, { Schema, type Document } from 'mongoose';

export interface IPickingItem {
  productId: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  quantityToPick: number;
  pickedQuantity: number;
}

export interface IPickingTask extends Document {
  taskNumber: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  warehouseId: mongoose.Types.ObjectId;
  pickerId?: string;
  pickerName?: string;
  items: IPickingItem[];
  status: 'PENDING' | 'IN_PROGRESS' | 'PICKED' | 'PACKED' | 'CANCELLED';
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickingItemSchema = new Schema<IPickingItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quantityToPick: { type: Number, required: true, min: 1 },
  pickedQuantity: { type: Number, required: true, default: 0, min: 0 },
});

const PickingTaskSchema = new Schema<IPickingTask>(
  {
    taskNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'OmnichannelOrder', required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    pickerId: { type: String, index: true },
    pickerName: { type: String },
    items: [PickingItemSchema],
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'PICKED', 'PACKED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const PickingTask = mongoose.model<IPickingTask>('PickingTask', PickingTaskSchema);
