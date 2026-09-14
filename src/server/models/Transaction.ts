import mongoose, { Schema, type Document } from 'mongoose';

export interface ITransactionItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  priceTier?: 'RETAIL' | 'WHOLESALE';
  price: number;
  discount: number;
  total: number;
}

export interface ITransaction extends Document {
  transactionNumber: string;
  type: 'SALE' | 'RETURN' | 'TRANSFER';
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
  pricingMode?: 'RETAIL' | 'WHOLESALE' | 'MIXED';
  items: ITransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE';
  currencyCode: string;
  exchangeRate: number;
  cashierId: string;
  cashierName: string;
  branchId: string;
  branchName: string;
  tenantId?: string;
  customerEmail?: string;
  companyName?: string;
  companyLogoUrl?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyTaxId?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionItemSchema = new Schema<ITransactionItem>({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  priceTier: { type: String, enum: ['RETAIL', 'WHOLESALE'], default: 'RETAIL' },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true },
});

const TransactionSchema = new Schema<ITransaction>(
  {
    tenantId: { type: String, default: 'default', index: true },
    idempotencyKey: { type: String, index: true, sparse: true },
    pricingMode: { type: String, enum: ['RETAIL', 'WHOLESALE', 'MIXED'], default: 'RETAIL' },
    transactionNumber: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, enum: ['SALE', 'RETURN', 'TRANSFER'], default: 'SALE' },
    status: {
      type: String,
      required: true,
      enum: ['COMPLETED', 'PENDING', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
    items: [TransactionItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE'],
      default: 'CASH',
    },
    customerEmail: { type: String, required: false },
    companyName: { type: String },
    companyLogoUrl: { type: String },
    companyAddress: { type: String },
    companyPhone: { type: String },
    companyEmail: { type: String },
    companyTaxId: { type: String },
    receiptHeader: { type: String },
    receiptFooter: { type: String },
    currencyCode: { type: String, default: 'USD', uppercase: true },
    exchangeRate: { type: Number, default: 1.0 },
    cashierId: { type: String, required: true, index: true },
    cashierName: { type: String, required: true },
    branchId: { type: String, required: true, index: true },
    branchName: { type: String, required: true },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
