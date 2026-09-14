import mongoose, { Schema, type Document } from 'mongoose';
import type { BillingInterval } from './Plan.js';

export type BillingInvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'REFUNDED' | 'OVERDUE';

export interface IBillingInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IBillingInvoice extends Document {
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  subscriptionId?: mongoose.Types.ObjectId;
  planId?: mongoose.Types.ObjectId;
  planName: string;
  planSlug: string;
  billingInterval: BillingInterval;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subtotal: number;
  tax: number;
  taxRate: number; // e.g. 0.075 for 7.5% VAT
  discount: number;
  total: number;
  amountPaid: number;
  amountOutstanding?: number;
  currency: string;
  status: BillingInvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  transactionReference?: string;
  lineItems: IBillingInvoiceLineItem[];
  planSnapshot?: Record<string, any>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillingInvoiceLineItemSchema = new Schema<IBillingInvoiceLineItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const BillingInvoiceSchema = new Schema<IBillingInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    tenantName: { type: String, required: true },
    tenantEmail: { type: String, required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
    planName: { type: String, required: true },
    planSlug: { type: String, required: true },
    billingInterval: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      required: true,
      default: 'MONTHLY',
    },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, default: 0, min: 0 },
    taxRate: { type: Number, required: true, default: 0, min: 0 },
    discount: { type: Number, required: true, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    amountOutstanding: { type: Number, min: 0, default: 0 },
    currency: { type: String, required: true, default: 'NGN', uppercase: true },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'PAID', 'VOID', 'REFUNDED', 'OVERDUE'],
      required: true,
      default: 'OPEN',
      index: true,
    },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    paidDate: { type: Date },
    transactionReference: { type: String, index: true, sparse: true },
    lineItems: [BillingInvoiceLineItemSchema],
    planSnapshot: { type: Schema.Types.Mixed },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

BillingInvoiceSchema.index({ tenantId: 1, createdAt: -1 });

export const BillingInvoice = mongoose.model<IBillingInvoice>(
  'BillingInvoice',
  BillingInvoiceSchema
);
