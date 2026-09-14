import mongoose, { Schema, Document } from 'mongoose';

export interface IExpenseCategory extends Document {
  tenantId?: string;
  name: string;
  code: string;
  description?: string;
  accountId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    tenantId: { type: String, index: true },
    name: { type: String, required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const ExpenseCategory = mongoose.model<IExpenseCategory>(
  'ExpenseCategory',
  ExpenseCategorySchema
);
