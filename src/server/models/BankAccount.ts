import mongoose, { Schema, Document } from 'mongoose';

export interface IBankAccount extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  accountName: string;
  bankName: string;
  accountNumberMasked: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  glAccountId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BankAccountSchema = new Schema<IBankAccount>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    accountName: { type: String, required: true, index: true },
    bankName: { type: String, required: true },
    accountNumberMasked: { type: String, required: true },
    currency: { type: String, required: true, default: 'USD' },
    openingBalance: { type: Number, required: true, default: 0 },
    currentBalance: { type: Number, required: true, default: 0 },
    glAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const BankAccount = mongoose.model<IBankAccount>('BankAccount', BankAccountSchema);
