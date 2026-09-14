import mongoose, { Schema, type Document } from 'mongoose';

export interface IOmnichannelOrderItem {
  productId: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  quantity: number;
  priceTier?: 'RETAIL' | 'WHOLESALE';
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}

export interface IPaymentAllocation {
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'STORE_CREDIT' | 'WALLET';
  amount: number;
  referenceNumber?: string;
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';
  paidAt?: Date;
}

export interface IOmnichannelOrder extends Document {
  tenantId?: string;
  orderNumber: string;
  channel: 'POS' | 'WEBSITE' | 'MOBILE' | 'MARKETPLACE' | 'API' | 'MANUAL';
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  customerEmail?: string;
  branchId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  cashierId?: string;
  cashierName?: string;
  items: IOmnichannelOrderItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  currencyCode: string;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  payments: IPaymentAllocation[];
  fulfillmentStatus:
    | 'UNFULFILLED'
    | 'PICKING'
    | 'PICKED'
    | 'PACKED'
    | 'READY_FOR_PICKUP'
    | 'SHIPPED'
    | 'DISPATCHED'
    | 'DELIVERED'
    | 'CANCELLED';
  fulfillmentMethod: 'SHIP' | 'PICKUP' | 'STORE_PICKUP';
  status:
    | 'DRAFT'
    | 'PENDING_PAYMENT'
    | 'PAID'
    | 'PROCESSING'
    | 'READY_FOR_FULFILLMENT'
    | 'PARTIALLY_FULFILLED'
    | 'FULFILLED'
    | 'CANCELLED'
    | 'RETURNED'
    | 'REFUNDED'
    | 'COMPLETED';
  riskScore: number;
  riskLevel: 'NORMAL' | 'REVIEW' | 'HIGH_RISK';
  pricingMode?: 'RETAIL' | 'WHOLESALE' | 'MIXED';
  idempotencyKey?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OmnichannelOrderItemSchema = new Schema<IOmnichannelOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  priceTier: { type: String, enum: ['RETAIL', 'WHOLESALE'], default: 'RETAIL' },
  unitPrice: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, default: 0, min: 0 },
  tax: { type: Number, required: true, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
});

const PaymentAllocationSchema = new Schema<IPaymentAllocation>({
  paymentMethod: {
    type: String,
    enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'STORE_CREDIT', 'WALLET'],
    required: true,
  },
  amount: { type: Number, required: true, min: 0 },
  referenceNumber: { type: String },
  status: {
    type: String,
    enum: ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PAID',
  },
  paidAt: { type: Date, default: Date.now },
});

const OmnichannelOrderSchema = new Schema<IOmnichannelOrder>(
  {
    tenantId: { type: String, index: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    pricingMode: {
      type: String,
      enum: ['RETAIL', 'WHOLESALE', 'MIXED'],
      default: 'RETAIL',
    },
    channel: {
      type: String,
      enum: ['POS', 'WEBSITE', 'MOBILE', 'MARKETPLACE', 'API', 'MANUAL'],
      required: true,
      default: 'POS',
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    customerName: { type: String },
    customerEmail: { type: String },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    cashierId: { type: String, index: true },
    cashierName: { type: String },
    items: [OmnichannelOrderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    taxTotal: { type: Number, required: true, min: 0, default: 0 },
    discountTotal: { type: Number, required: true, min: 0, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    currencyCode: { type: String, default: 'USD', uppercase: true },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      default: 'UNPAID',
      index: true,
    },
    payments: [PaymentAllocationSchema],
    fulfillmentStatus: {
      type: String,
      enum: [
        'UNFULFILLED',
        'PICKING',
        'PICKED',
        'PACKED',
        'READY_FOR_PICKUP',
        'SHIPPED',
        'DISPATCHED',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'UNFULFILLED',
      index: true,
    },
    fulfillmentMethod: {
      type: String,
      enum: ['SHIP', 'PICKUP', 'STORE_PICKUP'],
      default: 'PICKUP',
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_PAYMENT',
        'PAID',
        'PROCESSING',
        'READY_FOR_FULFILLMENT',
        'PARTIALLY_FULFILLED',
        'FULFILLED',
        'CANCELLED',
        'RETURNED',
        'REFUNDED',
        'COMPLETED',
      ],
      default: 'PENDING_PAYMENT',
      required: true,
      index: true,
    },
    riskScore: { type: Number, default: 0 },
    riskLevel: {
      type: String,
      enum: ['NORMAL', 'REVIEW', 'HIGH_RISK'],
      default: 'NORMAL',
      index: true,
    },
    idempotencyKey: { type: String, index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const OmnichannelOrder = mongoose.model<IOmnichannelOrder>(
  'OmnichannelOrder',
  OmnichannelOrderSchema
);
