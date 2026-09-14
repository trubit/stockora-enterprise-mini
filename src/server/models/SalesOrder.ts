import mongoose, { Schema, type Document } from 'mongoose';

export interface IFulfillmentGroup {
  warehouseId: mongoose.Types.ObjectId;
  warehouseName?: string;
  items: {
    productId: mongoose.Types.ObjectId;
    sku: string;
    quantity: number;
    shippedQuantity: number;
  }[];
  status: 'PENDING' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  trackingNumber?: string;
}

export interface ISalesOrderItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  name?: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  shippedQuantity: number;
}

export interface ISalesOrder extends Document {
  tenantId: string;
  companyId: string;
  orderNumber: string;
  channelId?: mongoose.Types.ObjectId;
  channelCode?: string;
  quoteId?: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  customerPoNumber?: string;
  salesRepId?: string;
  salesRepName?: string;
  territoryId?: mongoose.Types.ObjectId;
  items: ISalesOrderItem[];
  fulfillmentGroups: IFulfillmentGroup[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  paymentTerms?: string;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  creditApproved: boolean;
  status:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'ON_HOLD'
    | 'APPROVED'
    | 'ALLOCATED'
    | 'PARTIALLY_SHIPPED'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED';
  idempotencyKey?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesOrderItemSchema = new Schema<ISalesOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String },
  name: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, default: 0, min: 0 },
  tax: { type: Number, required: true, default: 0, min: 0 },
  shippedQuantity: { type: Number, required: true, default: 0, min: 0 },
});

const FulfillmentGroupSchema = new Schema<IFulfillmentGroup>({
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  warehouseName: { type: String },
  items: [
    {
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      sku: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      shippedQuantity: { type: Number, default: 0, min: 0 },
    },
  ],
  status: {
    type: String,
    enum: ['PENDING', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING',
  },
  trackingNumber: { type: String },
});

const SalesOrderSchema = new Schema<ISalesOrder>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    orderNumber: { type: String, required: true, unique: true, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'SalesChannel', index: true },
    channelCode: { type: String, index: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'SalesQuote', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    customerName: { type: String },
    customerPoNumber: { type: String, index: true },
    salesRepId: { type: String, index: true },
    salesRepName: { type: String },
    territoryId: { type: Schema.Types.ObjectId, ref: 'SalesTerritory', index: true },
    items: [SalesOrderItemSchema],
    fulfillmentGroups: [FulfillmentGroupSchema],
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    paymentTerms: { type: String, default: 'IMMEDIATE' },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
      index: true,
    },
    creditApproved: { type: Boolean, default: true },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING',
        'PENDING_APPROVAL',
        'ON_HOLD',
        'APPROVED',
        'ALLOCATED',
        'PARTIALLY_SHIPPED',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'APPROVED',
      required: true,
      index: true,
    },
    idempotencyKey: { type: String, index: true, sparse: true },
    notes: { type: String },
  },
  { timestamps: true }
);

SalesOrderSchema.index({ tenantId: 1, companyId: 1, orderNumber: 1 });

export const SalesOrder = mongoose.model<ISalesOrder>('SalesOrder', SalesOrderSchema);
