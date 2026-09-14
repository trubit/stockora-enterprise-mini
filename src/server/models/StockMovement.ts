import mongoose, { Schema, type Document } from 'mongoose';

export type StockMovementType =
  | 'OPENING_STOCK'
  | 'RECEIPT'
  | 'PURCHASE_RECEIPT'
  | 'PUT_AWAY'
  | 'PICK'
  | 'PACK'
  | 'DISPATCH'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT'
  | 'CYCLE_COUNT'
  | 'RETURN'
  | 'SUPPLIER_RETURN'
  | 'DAMAGE'
  | 'QUARANTINE'
  | 'QUARANTINE_RELEASE'
  | 'WRITE_OFF'
  | 'SALE'
  | 'PURCHASE';

export interface IStockMovement extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  fromLocationId?: mongoose.Types.ObjectId;
  fromWarehouseId?: mongoose.Types.ObjectId;
  toLocationId?: mongoose.Types.ObjectId;
  toWarehouseId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  referenceId?: string;
  referenceType?: string;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: Date;
  userId?: mongoose.Types.ObjectId;
  notes?: string;
  isReversal: boolean;
  reversalOfId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: {
      type: String,
      enum: [
        'OPENING_STOCK',
        'RECEIPT',
        'PURCHASE_RECEIPT',
        'PUT_AWAY',
        'PICK',
        'PACK',
        'DISPATCH',
        'TRANSFER_OUT',
        'TRANSFER_IN',
        'ADJUSTMENT',
        'CYCLE_COUNT',
        'RETURN',
        'SUPPLIER_RETURN',
        'DAMAGE',
        'QUARANTINE',
        'QUARANTINE_RELEASE',
        'WRITE_OFF',
        'SALE',
        'PURCHASE',
      ],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0, default: 0 },
    fromLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation', index: true },
    fromWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    toLocationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation', index: true },
    toWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    referenceId: { type: String, index: true },
    referenceType: { type: String },
    lotNumber: { type: String, trim: true, index: true },
    serialNumber: { type: String, trim: true, index: true },
    expiryDate: { type: Date },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    notes: { type: String },
    isReversal: { type: Boolean, default: false },
    reversalOfId: { type: Schema.Types.ObjectId, ref: 'StockMovement' },
  },
  { timestamps: true }
);

export const StockMovement =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
