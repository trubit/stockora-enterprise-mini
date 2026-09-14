import mongoose, { Schema, type Document } from 'mongoose';

export type HoldReason =
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'FRAUD_REVIEW'
  | 'PAYMENT_PENDING'
  | 'STOCK_UNAVAILABLE'
  | 'APPROVAL_REQUIRED'
  | 'ADDRESS_VERIFICATION'
  | 'MANUAL_HOLD';

export interface ISalesOrderHold extends Document {
  tenantId: string;
  companyId: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  reason: HoldReason;
  status: 'ACTIVE' | 'RELEASED' | 'REJECTED';
  notes?: string;
  createdBy: string;
  createdByName?: string;
  releasedBy?: string;
  releasedByName?: string;
  releasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SalesOrderHoldSchema = new Schema<ISalesOrderHold>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    orderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    reason: {
      type: String,
      enum: [
        'CREDIT_LIMIT_EXCEEDED',
        'FRAUD_REVIEW',
        'PAYMENT_PENDING',
        'STOCK_UNAVAILABLE',
        'APPROVAL_REQUIRED',
        'ADDRESS_VERIFICATION',
        'MANUAL_HOLD',
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RELEASED', 'REJECTED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    notes: { type: String },
    createdBy: { type: String, required: true },
    createdByName: { type: String },
    releasedBy: { type: String },
    releasedByName: { type: String },
    releasedAt: { type: Date },
  },
  { timestamps: true }
);

export const SalesOrderHold = mongoose.model<ISalesOrderHold>(
  'SalesOrderHold',
  SalesOrderHoldSchema
);
