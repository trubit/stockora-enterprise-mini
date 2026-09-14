import mongoose, { Schema, Document } from 'mongoose';

export interface ITaxRecord extends Document {
  tenantId?: string;
  taxRateId?: mongoose.Types.ObjectId;
  taxCode: string;
  transactionType: 'COLLECTED' | 'PAID' | 'REFUNDED';
  taxableAmount: number;
  taxAmount: number;
  currency: string;
  referenceId?: string;
  periodCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaxRecordSchema = new Schema<ITaxRecord>(
  {
    tenantId: { type: String, index: true },
    taxRateId: { type: Schema.Types.ObjectId, ref: 'TaxRate' },
    taxCode: { type: String, required: true, index: true },
    transactionType: {
      type: String,
      enum: ['COLLECTED', 'PAID', 'REFUNDED'],
      required: true,
      index: true,
    },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD' },
    referenceId: { type: String, index: true },
    periodCode: { type: String, index: true },
  },
  { timestamps: true }
);

export const TaxRecord = mongoose.model<ITaxRecord>('TaxRecord', TaxRecordSchema);
