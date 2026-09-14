import mongoose, { Schema, type Document } from 'mongoose';

export interface ITenantUsageMetrics {
  users: number;
  branches: number;
  warehouses: number;
  posTerminals: number;
  products: number;
  customers: number;
  orders: number;
  storageMb: number;
  apiRequestsMonthly: number;
  aiRequestsMonthly: number;
  automations: number;
}

export interface ITenantUsage extends Document {
  tenantId: string;
  billingPeriod: string; // e.g. '2026-08'
  periodStart: Date;
  periodEnd: Date;
  metrics: ITenantUsageMetrics;
  lastReconciledAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const TenantUsageMetricsSchema = new Schema<ITenantUsageMetrics>(
  {
    users: { type: Number, default: 0 },
    branches: { type: Number, default: 0 },
    warehouses: { type: Number, default: 0 },
    posTerminals: { type: Number, default: 0 },
    products: { type: Number, default: 0 },
    customers: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    storageMb: { type: Number, default: 0 },
    apiRequestsMonthly: { type: Number, default: 0 },
    aiRequestsMonthly: { type: Number, default: 0 },
    automations: { type: Number, default: 0 },
  },
  { _id: false }
);

const TenantUsageSchema = new Schema<ITenantUsage>(
  {
    tenantId: { type: String, required: true, index: true },
    billingPeriod: { type: String, required: true, index: true }, // e.g. '2026-08'
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    metrics: { type: TenantUsageMetricsSchema, required: true, default: () => ({}) },
    lastReconciledAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

TenantUsageSchema.index({ tenantId: 1, billingPeriod: 1 }, { unique: true });

export const TenantUsage = mongoose.model<ITenantUsage>('TenantUsage', TenantUsageSchema);
