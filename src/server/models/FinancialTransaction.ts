import mongoose, { Schema, Document } from 'mongoose';

export type FinancialTransactionType =
  | 'REVENUE'
  | 'EXPENSE'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_MADE'
  | 'REFUND_ISSUED'
  | 'TAX_LIABILITY'
  | 'TRANSFER';

export interface IFinancialTransaction extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  transactionNumber: string;
  type: FinancialTransactionType;
  amount: number;
  currency: string;
  paymentMethod: string;
  sourceModule: string;
  referenceId?: string;
  journalEntryId?: mongoose.Types.ObjectId;
  description: string;
  metadata?: Record<string, any>;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialTransactionSchema = new Schema<IFinancialTransaction>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    transactionNumber: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: [
        'REVENUE',
        'EXPENSE',
        'PAYMENT_RECEIVED',
        'PAYMENT_MADE',
        'REFUND_ISSUED',
        'TAX_LIABILITY',
        'TRANSFER',
      ],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD' },
    paymentMethod: { type: String, required: true, default: 'CASH', index: true },
    sourceModule: { type: String, required: true, default: 'FINANCE', index: true },
    referenceId: { type: String, index: true },
    journalEntryId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const FinancialTransaction = mongoose.model<IFinancialTransaction>(
  'FinancialTransaction',
  FinancialTransactionSchema
);
