import mongoose, { Schema, type Document } from 'mongoose';

export type BillingTransactionType =
  'SUBSCRIPTION_PAYMENT' | 'RENEWAL' | 'UPGRADE' | 'DOWNGRADE' | 'REFUND' | 'ADJUSTMENT';

export type BillingTransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export interface IBillingTransaction extends Document {
  tenantId: string;
  subscriptionId?: mongoose.Types.ObjectId;
  planId?: mongoose.Types.ObjectId;
  planSlug?: string;
  subtotal?: number;
  tax?: number;
  taxRate?: number;
  amount: number;
  amountPaid?: number;
  currency: string;
  provider: 'PAYSTACK' | 'STRIPE' | 'MANUAL' | 'SYSTEM';
  providerReference: string;
  providerEventId?: string;
  status: BillingTransactionStatus;
  type: BillingTransactionType;
  billingReason?: string;
  paymentMethod?: string;
  gatewayResponse?: string;
  refundId?: string;
  refundAmount?: number;
  refundReason?: string;
  paidAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const BillingTransactionSchema = new Schema<IBillingTransaction>(
  {
    tenantId: { type: String, required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
    planSlug: { type: String },
    subtotal: { type: Number, min: 0 },
    tax: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, default: 0 },
    amount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, min: 0, default: 0 },
    currency: { type: String, required: true, default: 'NGN', uppercase: true },
    provider: {
      type: String,
      enum: ['PAYSTACK', 'STRIPE', 'MANUAL', 'SYSTEM'],
      default: 'PAYSTACK',
    },
    providerReference: { type: String, required: true, unique: true, index: true },
    providerEventId: { type: String, index: true, sparse: true },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED'],
      required: true,
      default: 'PENDING',
      index: true,
    },
    type: {
      type: String,
      enum: ['SUBSCRIPTION_PAYMENT', 'RENEWAL', 'UPGRADE', 'DOWNGRADE', 'REFUND', 'ADJUSTMENT'],
      required: true,
      default: 'SUBSCRIPTION_PAYMENT',
      index: true,
    },
    billingReason: { type: String },
    paymentMethod: { type: String },
    gatewayResponse: { type: String },
    refundId: { type: String },
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String },
    paidAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

BillingTransactionSchema.index({ tenantId: 1, createdAt: -1 });

export const BillingTransaction = mongoose.model<IBillingTransaction>(
  'BillingTransaction',
  BillingTransactionSchema
);
