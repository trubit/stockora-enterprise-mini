import mongoose, { Schema, type Document } from 'mongoose';

export interface ISalesReturnItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  reason: string;
  condition: 'SELLABLE' | 'DAMAGED';
  action: 'REFUND' | 'EXCHANGE';
}

export interface IExchangeItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
}

export interface ISalesReturn extends Document {
  returnNumber: string;
  transactionNumber: string;
  items: ISalesReturnItem[];
  exchangeItems: IExchangeItem[];
  refundType: 'FULL' | 'PARTIAL';
  refundAmount: number;
  exchangePriceDifference: number;
  refundMethod: 'CASH' | 'CARD' | 'STORE_CREDIT' | 'WALLET';
  walletRefundRef?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
  createdBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SalesReturnItemSchema = new Schema<ISalesReturnItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true },
  condition: { type: String, required: true, enum: ['SELLABLE', 'DAMAGED'], default: 'SELLABLE' },
  action: { type: String, required: true, enum: ['REFUND', 'EXCHANGE'], default: 'REFUND' },
});

const ExchangeItemSchema = new Schema<IExchangeItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
});

const SalesReturnSchema = new Schema<ISalesReturn>(
  {
    returnNumber: { type: String, required: true, unique: true, index: true, uppercase: true },
    transactionNumber: { type: String, required: true, index: true },
    items: [SalesReturnItemSchema],
    exchangeItems: { type: [ExchangeItemSchema], default: [] },
    refundType: { type: String, required: true, enum: ['FULL', 'PARTIAL'], default: 'FULL' },
    refundAmount: { type: Number, required: true, default: 0, min: 0 },
    exchangePriceDifference: { type: Number, default: 0 },
    refundMethod: {
      type: String,
      required: true,
      enum: ['CASH', 'CARD', 'STORE_CREDIT', 'WALLET'],
      default: 'CASH',
    },
    walletRefundRef: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
      default: 'PENDING',
      index: true,
    },
    notes: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
SalesReturnSchema.index({ status: 1, createdAt: -1 });
SalesReturnSchema.index({ createdBy: 1, createdAt: -1 });

export const SalesReturn = mongoose.model<ISalesReturn>('SalesReturn', SalesReturnSchema);
