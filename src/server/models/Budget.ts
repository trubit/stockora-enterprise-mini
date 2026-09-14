import mongoose, { Schema, Document } from 'mongoose';

export interface IBudgetLine {
  categoryId?: mongoose.Types.ObjectId;
  categoryName: string;
  targetAmount: number;
  actualAmount: number;
  varianceAmount: number;
}

export interface IBudget extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  budgetName: string;
  fiscalYear: number;
  periodCode?: string;
  totalTargetAmount: number;
  totalActualAmount: number;
  variance: number;
  lines: IBudgetLine[];
  createdAt: Date;
  updatedAt: Date;
}

const BudgetLineSchema = new Schema<IBudgetLine>({
  categoryId: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory' },
  categoryName: { type: String, required: true },
  targetAmount: { type: Number, required: true, min: 0 },
  actualAmount: { type: Number, required: true, default: 0 },
  varianceAmount: { type: Number, required: true, default: 0 },
});

const BudgetSchema = new Schema<IBudget>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    budgetName: { type: String, required: true, index: true },
    fiscalYear: { type: Number, required: true, index: true },
    periodCode: { type: String, index: true },
    totalTargetAmount: { type: Number, required: true, min: 0 },
    totalActualAmount: { type: Number, required: true, default: 0 },
    variance: { type: Number, required: true, default: 0 },
    lines: [BudgetLineSchema],
  },
  { timestamps: true }
);

export const Budget = mongoose.model<IBudget>('Budget', BudgetSchema);
