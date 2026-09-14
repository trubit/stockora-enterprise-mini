import mongoose, { Schema, type Document } from 'mongoose';

export type ConsentChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP' | 'TELEMARKETING';
export type ConsentStatus = 'OPT_IN' | 'OPT_OUT' | 'PENDING';

export interface ICustomerConsent extends Document {
  tenantId: string;
  customerId: mongoose.Types.ObjectId;
  customerEmail: string;
  channel: ConsentChannel;
  status: ConsentStatus;
  source: string; // e.g. "CHECKOUT_CHECKBOX", "PREFERENCES_CONSOLE", "API", "POS_KEYPAD"
  policyVersion: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  revokedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerConsentSchema = new Schema<ICustomerConsent>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerEmail: { type: String, required: true, index: true },
    channel: {
      type: String,
      enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP', 'TELEMARKETING'],
      required: true,
    },
    status: {
      type: String,
      enum: ['OPT_IN', 'OPT_OUT', 'PENDING'],
      required: true,
      default: 'OPT_IN',
      index: true,
    },
    source: { type: String, required: true, default: 'PREFERENCES_CONSOLE' },
    policyVersion: { type: String, required: true, default: 'v1.0' },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, required: true, default: Date.now },
    revokedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

CustomerConsentSchema.index({ tenantId: 1, customerId: 1, channel: 1 });

export const CustomerConsent = mongoose.model<ICustomerConsent>(
  'CustomerConsent',
  CustomerConsentSchema
);
