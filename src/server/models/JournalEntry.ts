import mongoose, { Schema, Document } from 'mongoose';

export interface IJournalLine {
  accountId: mongoose.Types.ObjectId;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
  taxCode?: string;
  branchId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
}

export type JournalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REVERSED';

export interface IJournalEntry extends Document {
  tenantId: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  fiscalPeriodId?: mongoose.Types.ObjectId;
  entryNumber: string;
  postingDate: Date;
  description: string;
  source: string;
  referenceId?: string;
  currency: string;
  lines: IJournalLine[];
  totalDebit: number;
  totalCredit: number;
  status: JournalStatus;
  postedBy?: mongoose.Types.ObjectId;
  reversedByEntryId?: mongoose.Types.ObjectId;
  reversalReason?: string;
  isAdjustment?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const JournalLineSchema = new Schema<IJournalLine>({
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  accountCode: { type: String, required: true },
  accountName: { type: String, required: true },
  debit: { type: Number, required: true, default: 0, min: 0 },
  credit: { type: Number, required: true, default: 0, min: 0 },
  memo: { type: String },
  taxCode: { type: String },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
});

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    tenantId: { type: String, required: true, default: 'default', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    fiscalPeriodId: { type: Schema.Types.ObjectId, ref: 'FiscalPeriod', index: true },
    entryNumber: { type: String, required: true, index: true },
    postingDate: { type: Date, required: true, default: Date.now, index: true },
    description: { type: String, required: true },
    source: { type: String, required: true, default: 'MANUAL', index: true },
    referenceId: { type: String, index: true },
    currency: { type: String, required: true, default: 'USD' },
    lines: { type: [JournalLineSchema], required: true },
    totalDebit: { type: Number, required: true, default: 0 },
    totalCredit: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'POSTED', 'REVERSED'],
      required: true,
      default: 'DRAFT',
      index: true,
    },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversedByEntryId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    reversalReason: { type: String },
    isAdjustment: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Pre-save validation enforcing Double-Entry Balance: Total Debits == Total Credits
JournalEntrySchema.pre<IJournalEntry>('save', function (next) {
  let debitSum = 0;
  let creditSum = 0;

  for (const line of this.lines) {
    debitSum += line.debit || 0;
    creditSum += line.credit || 0;
  }

  // Rounding precision check up to 2 decimal places
  this.totalDebit = Math.round(debitSum * 100) / 100;
  this.totalCredit = Math.round(creditSum * 100) / 100;

  if (Math.abs(this.totalDebit - this.totalCredit) > 0.001) {
    return next(
      new Error(
        `Unbalanced Journal Entry: Total Debits ($${this.totalDebit}) must equal Total Credits ($${this.totalCredit}).`
      )
    );
  }

  next();
});

JournalEntrySchema.index({ tenantId: 1, entryNumber: 1 }, { unique: true });
JournalEntrySchema.index({ tenantId: 1, postingDate: -1 });
JournalEntrySchema.index({ tenantId: 1, 'lines.accountId': 1, postingDate: -1 });
JournalEntrySchema.index({ tenantId: 1, source: 1, referenceId: 1 });

export const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema);
