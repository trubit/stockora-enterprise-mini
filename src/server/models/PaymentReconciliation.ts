import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMatchStatus =
  'MATCHED' | 'PENDING' | 'PARTIALLY_MATCHED' | 'MISMATCHED' | 'FAILED';

export interface IReconciliationLine {
  transactionId?: string;
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  provider: 'PAYSTACK' | 'STRIPE' | 'BANK_TRANSFER' | 'POS_CASH' | 'POS_CARD' | 'OTHER';
  providerTransactionRef?: string;
  grossAmount: number;
  providerFee: number;
  netSettlementAmount: number;
  systemAmount: number;
  variance: number;
  status: PaymentMatchStatus;
  matchedAt?: Date;
  mismatchReason?: string;
  journalEntryId?: mongoose.Types.ObjectId;
}

export interface IPaymentReconciliation extends Document {
  tenantId: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  reconciliationNumber: string;
  statementDate: Date;
  bankAccountId?: mongoose.Types.ObjectId;
  gatewayProvider: string;
  totalTransactions: number;
  totalGrossAmount: number;
  totalFeeAmount: number;
  totalNetSettlement: number;
  matchedCount: number;
  unmatchedCount: number;
  discrepancyCount: number;
  status: PaymentMatchStatus;
  lines: IReconciliationLine[];
  notes?: string;
  reconciledBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReconciliationLineSchema = new Schema<IReconciliationLine>({
  transactionId: { type: String },
  orderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder' },
  orderNumber: { type: String },
  provider: {
    type: String,
    enum: ['PAYSTACK', 'STRIPE', 'BANK_TRANSFER', 'POS_CASH', 'POS_CARD', 'OTHER'],
    required: true,
    default: 'PAYSTACK',
  },
  providerTransactionRef: { type: String, index: true },
  grossAmount: { type: Number, required: true, default: 0 },
  providerFee: { type: Number, required: true, default: 0 },
  netSettlementAmount: { type: Number, required: true, default: 0 },
  systemAmount: { type: Number, required: true, default: 0 },
  variance: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ['MATCHED', 'PENDING', 'PARTIALLY_MATCHED', 'MISMATCHED', 'FAILED'],
    required: true,
    default: 'PENDING',
  },
  matchedAt: { type: Date },
  mismatchReason: { type: String },
  journalEntryId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
});

const PaymentReconciliationSchema = new Schema<IPaymentReconciliation>(
  {
    tenantId: { type: String, required: true, default: 'default', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    reconciliationNumber: { type: String, required: true, index: true },
    statementDate: { type: Date, required: true, default: Date.now, index: true },
    bankAccountId: { type: Schema.Types.ObjectId, ref: 'BankAccount' },
    gatewayProvider: { type: String, required: true, default: 'PAYSTACK' },
    totalTransactions: { type: Number, required: true, default: 0 },
    totalGrossAmount: { type: Number, required: true, default: 0 },
    totalFeeAmount: { type: Number, required: true, default: 0 },
    totalNetSettlement: { type: Number, required: true, default: 0 },
    matchedCount: { type: Number, required: true, default: 0 },
    unmatchedCount: { type: Number, required: true, default: 0 },
    discrepancyCount: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['MATCHED', 'PENDING', 'PARTIALLY_MATCHED', 'MISMATCHED', 'FAILED'],
      required: true,
      default: 'PENDING',
      index: true,
    },
    lines: { type: [ReconciliationLineSchema], default: [] },
    notes: { type: String },
    reconciledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PaymentReconciliationSchema.index({ tenantId: 1, reconciliationNumber: 1 }, { unique: true });
PaymentReconciliationSchema.index({ tenantId: 1, statementDate: -1 });
PaymentReconciliationSchema.index({ tenantId: 1, status: 1 });

export const PaymentReconciliation = mongoose.model<IPaymentReconciliation>(
  'PaymentReconciliation',
  PaymentReconciliationSchema
);
