import mongoose, { Schema, Document } from 'mongoose';

export interface IDebitNote extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  debitNoteNumber: string;
  supplierId: mongoose.Types.ObjectId;
  supplierName: string;
  amount: number;
  taxAmount: number;
  reason: string;
  status: 'DRAFT' | 'ISSUED' | 'APPLIED' | 'CANCELLED';
  journalEntryId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DebitNoteSchema = new Schema<IDebitNote>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    debitNoteNumber: { type: String, required: true, unique: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    supplierName: { type: String, required: true },
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

export const DebitNote = mongoose.model<IDebitNote>('DebitNote', DebitNoteSchema);
