import mongoose, { Schema, type Document } from 'mongoose';

/**
 * InventoryLocation — stock-at-location ledger.
 * Tracks the quantity of a specific product (and optionally batch/lot/serial)
 * held at a specific warehouse location. Updated atomically to prevent races.
 */
export interface IInventoryLocation extends Document {
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  /** Batch/lot number for lot-controlled products */
  lotNumber?: string;
  /** Expiry date for FEFO picking */
  expiryDate?: Date;
  /** Received date for FIFO picking */
  receivedDate?: Date;
  /** Serial number — null for non-serialized products */
  serialNumber?: string;
  /** Total on-hand quantity at this location */
  quantity: number;
  /** Quantity reserved (allocated to orders but not yet picked) */
  reservedQuantity: number;
  /** Quantity currently being picked (in-progress pick tasks) */
  pickingQuantity: number;
  /** Computed: quantity - reservedQuantity - pickingQuantity */
  availableQuantity: number;
  /** Cost basis for this lot at this location */
  costPrice?: number;
  supplierId?: mongoose.Types.ObjectId;
  purchaseOrderId?: mongoose.Types.ObjectId;
  goodsReceiptId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryLocationSchema = new Schema<IInventoryLocation>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'WarehouseLocation',
      required: true,
      index: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    lotNumber: { type: String, trim: true, index: true },
    expiryDate: { type: Date, index: true },
    receivedDate: { type: Date, index: true },
    serialNumber: { type: String, trim: true, sparse: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    pickingQuantity: { type: Number, default: 0, min: 0 },
    availableQuantity: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, min: 0 },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    goodsReceiptId: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt' },
  },
  { timestamps: true }
);

// Composite unique index: one record per product+lot+serial per location
InventoryLocationSchema.index(
  { locationId: 1, productId: 1, lotNumber: 1, serialNumber: 1 },
  { unique: true, sparse: true }
);
InventoryLocationSchema.index({ warehouseId: 1, productId: 1 });
InventoryLocationSchema.index({ productId: 1, expiryDate: 1 }); // for FEFO queries

export const InventoryLocation = mongoose.model<IInventoryLocation>(
  'InventoryLocation',
  InventoryLocationSchema
);
