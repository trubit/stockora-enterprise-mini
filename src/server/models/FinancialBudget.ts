import mongoose, { Schema, Document } from 'mongoose';

export type BudgetPeriodType = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type BudgetStatus = 'DRAFT' | 'ACTIVE' | 'EXCEEDED' | 'CLOSED';

export interface IFinancialBudget extends Document {
  tenantId: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  departmentName?: string;
  name: string;
  year: number;
  periodType: BudgetPeriodType;
  periodCode?: string; // e.g. "2026-M01", "2026-Q1"
  accountCategory: string; // e.g. "MARKETING", "RENT", "UTILITIES", "SALARIES", "SOFTWARE"
  allocatedAmount: number;
  spentAmount: number;
  committedAmount: number;
  remainingAmount: number;
  varianceAmount: number;
  variancePercentage: number;
  currency: string;
  thresholdAlertPct: number; // e.g. 85 for 85%
  isAlertTriggered: boolean;
  status: BudgetStatus;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialBudgetSchema = new Schema<IFinancialBudget>(
  {
    tenantId: { type: String, required: true, default: 'default', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    departmentName: { type: String },
    name: { type: String, required: true, index: true },
    year: { type: Number, required: true, index: true },
    periodType: {
      type: String,
      enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL'],
      required: true,
      default: 'MONTHLY',
    },
    periodCode: { type: String, index: true },
    accountCategory: { type: String, required: true, index: true },
    allocatedAmount: { type: Number, required: true, min: 0 },
    spentAmount: { type: Number, required: true, default: 0, min: 0 },
    committedAmount: { type: Number, required: true, default: 0, min: 0 },
    remainingAmount: { type: Number, required: true, default: 0 },
    varianceAmount: { type: Number, required: true, default: 0 },
    variancePercentage: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'USD' },
    thresholdAlertPct: { type: Number, required: true, default: 85, min: 1, max: 100 },
    isAlertTriggered: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'EXCEEDED', 'CLOSED'],
      required: true,
      default: 'ACTIVE',
      index: true,
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

FinancialBudgetSchema.index({ tenantId: 1, year: 1, accountCategory: 1, branchId: 1 });
FinancialBudgetSchema.index({ tenantId: 1, status: 1 });

export const FinancialBudget = mongoose.model<IFinancialBudget>(
  'FinancialBudget',
  FinancialBudgetSchema
);
