import mongoose, { Schema, type Document } from 'mongoose';

export type CreditRiskStatus = 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK' | 'CREDIT_HOLD';

export interface ICustomerCreditExposure extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  creditLimit: number;
  currentExposure: number;
  availableCredit: number;
  overdueBalance: number;
  paymentTerms: string; // e.g. NET 30, NET 60
  riskStatus: CreditRiskStatus;
  lastReviewDate: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerCreditExposureSchema = new Schema<ICustomerCreditExposure>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true,
      index: true,
    },
    customerName: { type: String, required: true },
    creditLimit: { type: Number, required: true, default: 0, min: 0 },
    currentExposure: { type: Number, required: true, default: 0, min: 0 },
    availableCredit: { type: Number, required: true, default: 0, min: 0 },
    overdueBalance: { type: Number, default: 0, min: 0 },
    paymentTerms: { type: String, default: 'NET 30' },
    riskStatus: {
      type: String,
      enum: ['LOW_RISK', 'MODERATE_RISK', 'HIGH_RISK', 'CREDIT_HOLD'],
      default: 'LOW_RISK',
      index: true,
    },
    lastReviewDate: { type: Date, default: Date.now },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
  },
  { timestamps: true }
);

export const CustomerCreditExposure =
  mongoose.models.CustomerCreditExposure ||
  mongoose.model<ICustomerCreditExposure>('CustomerCreditExposure', CustomerCreditExposureSchema);
