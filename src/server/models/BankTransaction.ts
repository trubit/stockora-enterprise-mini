import mongoose, { Schema, Document } from 'mongoose';

export type ReconciliationStatus = 'MATCHED' | 'PARTIALLY_MATCHED' | 'UNMATCHED' | 'EXCEPTION';

export interface IBankTransaction extends Document {
  tenantId?: string;
  bankAccountId: mongoose.Types.ObjectId;
  transactionDate: Date;
  reference: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  status: ReconciliationStatus;
  matchedTransactionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BankTransactionSchema = new Schema<IBankTransaction>(
  {
    tenantId: { type: String, index: true },
    bankAccountId: { type: Schema.Types.ObjectId, ref: 'BankAccount', required: true, index: true },
    transactionDate: { type: Date, required: true, default: Date.now, index: true },
    reference: { type: String, required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
    status: {
      type: String,
      enum: ['MATCHED', 'PARTIALLY_MATCHED', 'UNMATCHED', 'EXCEPTION'],
      required: true,
      default: 'UNMATCHED',
      index: true,
    },
    matchedTransactionId: { type: Schema.Types.ObjectId, ref: 'FinancialTransaction' },
  },
  { timestamps: true }
);

export const BankTransaction = mongoose.model<IBankTransaction>(
  'BankTransaction',
  BankTransactionSchema
);
