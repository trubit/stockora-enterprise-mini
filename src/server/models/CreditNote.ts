import mongoose, { Schema, Document } from 'mongoose';

export interface ICreditNote extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  creditNoteNumber: string;
  referenceInvoiceId?: mongoose.Types.ObjectId;
  referenceInvoiceNumber?: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  amount: number;
  taxAmount: number;
  reason: string;
  status: 'DRAFT' | 'ISSUED' | 'APPLIED' | 'CANCELLED';
  journalEntryId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CreditNoteSchema = new Schema<ICreditNote>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    creditNoteNumber: { type: String, required: true, unique: true, index: true },
    referenceInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    referenceInvoiceNumber: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, default: 0, min: 0 },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'APPLIED', 'CANCELLED'],
      required: true,
      default: 'DRAFT',
      index: true,
    },
    journalEntryId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
  },
  { timestamps: true }
);

export const CreditNote = mongoose.model<ICreditNote>('CreditNote', CreditNoteSchema);
