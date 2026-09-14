import mongoose, { Schema, Document } from 'mongoose';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'COGS';
export type AccountCategory =
  | 'CASH_AND_BANK'
  | 'RECEIVABLE'
  | 'INVENTORY'
  | 'CURRENT_ASSET'
  | 'NON_CURRENT_ASSET'
  | 'PAYABLE'
  | 'CURRENT_LIABILITY'
  | 'LONG_TERM_LIABILITY'
  | 'OWNERS_EQUITY'
  | 'RETAINED_EARNINGS'
  | 'OPERATING_REVENUE'
  | 'OTHER_INCOME'
  | 'COST_OF_GOODS_SOLD'
  | 'OPERATING_EXPENSE'
  | 'ADMINISTRATIVE_EXPENSE'
  | 'TAX_EXPENSE';

export interface IAccount extends Document {
  tenantId: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  code: string;
  name: string;
  type: AccountType;
  category?: AccountCategory;
  parentAccountId?: mongoose.Types.ObjectId;
  description?: string;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  allowReconciliation: boolean;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    tenantId: { type: String, required: true, default: 'default', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    code: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'CASH_AND_BANK',
        'RECEIVABLE',
        'INVENTORY',
        'CURRENT_ASSET',
        'NON_CURRENT_ASSET',
        'PAYABLE',
        'CURRENT_LIABILITY',
        'LONG_TERM_LIABILITY',
        'OWNERS_EQUITY',
        'RETAINED_EARNINGS',
        'OPERATING_REVENUE',
        'OTHER_INCOME',
        'COST_OF_GOODS_SOLD',
        'OPERATING_EXPENSE',
        'ADMINISTRATIVE_EXPENSE',
        'TAX_EXPENSE',
      ],
      index: true,
    },
    parentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', index: true },
    description: { type: String },
    openingBalance: { type: Number, required: true, default: 0 },
    currentBalance: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'USD' },
    allowReconciliation: { type: Boolean, default: false },
    isActive: { type: Boolean, required: true, default: true, index: true },
    isSystem: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

AccountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
AccountSchema.index({ tenantId: 1, type: 1, isActive: 1 });

export const Account = mongoose.model<IAccount>('Account', AccountSchema);
