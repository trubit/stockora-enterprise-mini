import mongoose, { Schema, type Document } from 'mongoose';

export type SalesChannelType = 'POS' | 'ONLINE' | 'B2B' | 'WHOLESALE' | 'MARKETPLACE' | 'MOBILE';

export type SalesTransactionStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'ALLOCATED'
  | 'PICKING'
  | 'PACKED'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethodType =
  'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_PAYMENT' | 'WALLET' | 'PAYSTACK' | 'CREDIT' | 'OTHER';

export interface IPaymentAllocation {
  method: PaymentMethodType;
  amount: number;
  referenceNumber?: string;
  gatewayTransactionId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  paidAt: Date;
}

export interface ISalesTransactionItem {
  productId: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface ISalesTransaction extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  terminalId?: mongoose.Types.ObjectId;
  registerSessionId?: mongoose.Types.ObjectId;
  channel: SalesChannelType;
  transactionNumber: string;
  idempotencyKey?: string;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  customerCode?: string;
  isGuest?: boolean;
  cashierId?: mongoose.Types.ObjectId;
  cashierName?: string;
  items: ISalesTransactionItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  currency: string;
  payments: IPaymentAllocation[];
  status: SalesTransactionStatus;
  isOfflineSync?: boolean;
  notes?: string;
  managerOverrideBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    method: {
      type: String,
      enum: [
        'CASH',
        'CARD',
        'BANK_TRANSFER',
        'MOBILE_PAYMENT',
        'WALLET',
        'PAYSTACK',
        'CREDIT',
        'OTHER',
      ],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    referenceNumber: { type: String },
    gatewayTransactionId: { type: String },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'SUCCESS' },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SalesTransactionItemSchema = new Schema<ISalesTransactionItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SalesTransactionSchema = new Schema<ISalesTransaction>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    terminalId: { type: Schema.Types.ObjectId, ref: 'POSTerminal', index: true },
    registerSessionId: { type: Schema.Types.ObjectId, ref: 'RegisterSession', index: true },
    channel: {
      type: String,
      enum: ['POS', 'ONLINE', 'B2B', 'WHOLESALE', 'MARKETPLACE', 'MOBILE'],
      default: 'POS',
      index: true,
    },
    transactionNumber: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    customerName: { type: String },
    customerCode: { type: String },
    isGuest: { type: Boolean, default: false },
    cashierId: { type: Schema.Types.ObjectId, ref: 'User' },
    cashierName: { type: String },
    items: [SalesTransactionItemSchema],
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true, trim: true },
    payments: [PaymentAllocationSchema],
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_PAYMENT',
        'PAID',
        'CONFIRMED',
        'ALLOCATED',
        'PICKING',
        'PACKED',
        'SHIPPED',
        'COMPLETED',
        'CANCELLED',
        'REFUNDED',
        'PARTIALLY_REFUNDED',
      ],
      default: 'COMPLETED',
      index: true,
    },
    isOfflineSync: { type: Boolean, default: false },
    notes: { type: String },
    managerOverrideBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SalesTransaction =
  mongoose.models.SalesTransaction ||
  mongoose.model<ISalesTransaction>('SalesTransaction', SalesTransactionSchema);
