import mongoose, { Schema, type Document } from 'mongoose';

export interface IProcurementBudget extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  department?: string;
  category?: string;
  fiscalYear: number;
  allocatedAmount: number;
  committedAmount: number;
  receivedAmount: number;
  invoicedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overBudgetPolicy: 'ALLOW_WARNING' | 'APPROVAL_REQUIRED' | 'BLOCK';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProcurementBudgetSchema = new Schema<IProcurementBudget>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    department: { type: String, trim: true, index: true },
    category: { type: String, trim: true, index: true },
    fiscalYear: { type: Number, required: true, default: 2026, index: true },
    allocatedAmount: { type: Number, required: true, min: 0 },
    committedAmount: { type: Number, default: 0, min: 0 },
    receivedAmount: { type: Number, default: 0, min: 0 },
    invoicedAmount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    overBudgetPolicy: {
      type: String,
      enum: ['ALLOW_WARNING', 'APPROVAL_REQUIRED', 'BLOCK'],
      default: 'APPROVAL_REQUIRED',
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const ProcurementBudget =
  mongoose.models.ProcurementBudget ||
  mongoose.model<IProcurementBudget>('ProcurementBudget', ProcurementBudgetSchema);
