import mongoose, { Schema, type Document } from 'mongoose';

export type BillingAuditAction =
  | 'PLAN_CREATED'
  | 'PLAN_UPDATED'
  | 'PLAN_ARCHIVED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_UPGRADED'
  | 'SUBSCRIPTION_DOWNGRADED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_REACTIVATED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'INVOICE_CREATED'
  | 'INVOICE_PAID'
  | 'REFUND_ISSUED'
  | 'LIMIT_WARNING'
  | 'LIMIT_EXCEEDED'
  | 'WEBHOOK_PROCESSED';

export interface IBillingAuditLog extends Document {
  tenantId: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: BillingAuditAction;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillingAuditLogSchema = new Schema<IBillingAuditLog>(
  {
    tenantId: { type: String, required: true, index: true },
    actorId: { type: String },
    actorEmail: { type: String },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    details: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: true,
  }
);

BillingAuditLogSchema.index({ tenantId: 1, createdAt: -1 });

export const BillingAuditLog = mongoose.model<IBillingAuditLog>(
  'BillingAuditLog',
  BillingAuditLogSchema
);
