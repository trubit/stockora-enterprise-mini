import mongoose, { Schema, type Document } from 'mongoose';
import type { BillingInterval } from './Plan.js';

export type SubscriptionStatus =
  'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'INCOMPLETE';

export type PaymentProviderType = 'PAYSTACK' | 'STRIPE' | 'MANUAL' | 'SYSTEM';

export interface IPlanSnapshot {
  name: string;
  slug: string;
  tier: string;
  price: number;
  currency: string;
  billingInterval: BillingInterval;
  features: Record<string, boolean>;
  limits: Record<string, { count: number; unlimited: boolean }>;
  version: number;
}

export interface ISubscription extends Document {
  tenantId: string;
  planId: mongoose.Types.ObjectId;
  planSlug: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currency: string;
  price: number;
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  renewalDate: Date;
  trialStartDate?: Date;
  trialEndDate?: Date;
  gracePeriodEndDate?: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  endedAt?: Date;
  provider: PaymentProviderType;
  providerSubscriptionId?: string;
  providerCustomerCode?: string;
  providerAuthCode?: string;
  lastPaymentReference?: string;
  lastPaymentDate?: Date;
  failedPaymentCount: number;
  planSnapshot: IPlanSnapshot;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSnapshotSchema = new Schema<IPlanSnapshot>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    tier: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, required: true },
    billingInterval: { type: String, required: true },
    features: { type: Schema.Types.Mixed, required: true, default: {} },
    limits: { type: Schema.Types.Mixed, required: true, default: {} },
    version: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const SubscriptionSchema = new Schema<ISubscription>(
  {
    tenantId: { type: String, required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    planSlug: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'INCOMPLETE'],
      required: true,
      default: 'TRIALING',
      index: true,
    },
    billingInterval: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      required: true,
      default: 'MONTHLY',
    },
    currency: { type: String, required: true, default: 'NGN' },
    price: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true, default: Date.now },
    currentPeriodStart: { type: Date, required: true, default: Date.now },
    currentPeriodEnd: { type: Date, required: true },
    renewalDate: { type: Date, required: true },
    trialStartDate: { type: Date },
    trialEndDate: { type: Date },
    gracePeriodEndDate: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    endedAt: { type: Date },
    provider: {
      type: String,
      enum: ['PAYSTACK', 'STRIPE', 'MANUAL', 'SYSTEM'],
      default: 'PAYSTACK',
    },
    providerSubscriptionId: { type: String },
    providerCustomerCode: { type: String },
    providerAuthCode: { type: String },
    lastPaymentReference: { type: String },
    lastPaymentDate: { type: Date },
    failedPaymentCount: { type: Number, default: 0 },
    planSnapshot: { type: PlanSnapshotSchema, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// Indexes
SubscriptionSchema.index({ tenantId: 1, status: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });
SubscriptionSchema.index({ trialEndDate: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
