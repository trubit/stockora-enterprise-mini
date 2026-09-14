import mongoose, { Schema, Document } from 'mongoose';

export type AgingBucket = 'CURRENT' | '1-30_DAYS' | '31-60_DAYS' | '61-90_DAYS' | '90+_DAYS';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface IPaymentRecord {
  paymentId?: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  journalEntryId?: mongoose.Types.ObjectId;
}

export interface IAccountsReceivable extends Document {
  tenantId: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  invoiceId?: mongoose.Types.ObjectId;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  agingBucket: AgingBucket;
  status: PaymentStatus;
  payments: IPaymentRecord[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRecordSchema = new Schema<IPaymentRecord>({
  paymentId: { type: String },
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true, default: Date.now },
  paymentMethod: { type: String, required: true, default: 'BANK_TRANSFER' },
  reference: { type: String },
  notes: { type: String },
  journalEntryId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
});

const AccountsReceivableSchema = new Schema<IAccountsReceivable>(
  {
    tenantId: { type: String, required: true, default: 'default', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    invoiceNumber: { type: String, required: true, index: true },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD' },
    issueDate: { type: Date, required: true, default: Date.now, index: true },
    dueDate: { type: Date, required: true, index: true },
    agingBucket: {
      type: String,
      enum: ['CURRENT', '1-30_DAYS', '31-60_DAYS', '61-90_DAYS', '90+_DAYS'],
      required: true,
      default: 'CURRENT',
      index: true,
    },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'],
      required: true,
      default: 'UNPAID',
      index: true,
    },
    payments: { type: [PaymentRecordSchema], default: [] },
    notes: { type: String },
  },
  { timestamps: true }
);

AccountsReceivableSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
AccountsReceivableSchema.index({ tenantId: 1, customerId: 1, status: 1 });
AccountsReceivableSchema.index({ tenantId: 1, dueDate: 1 });
AccountsReceivableSchema.index({ tenantId: 1, agingBucket: 1 });

export const AccountsReceivable = mongoose.model<IAccountsReceivable>(
  'AccountsReceivable',
  AccountsReceivableSchema
);
