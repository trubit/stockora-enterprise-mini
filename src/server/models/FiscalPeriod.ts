import mongoose, { Schema, Document } from 'mongoose';

export type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED' | 'AUDITED';

export interface IFiscalPeriod extends Document {
  tenantId: string;
  companyId?: mongoose.Types.ObjectId;
  periodCode: string; // e.g. "2026-M01", "2026-Q1"
  name: string;
  year: number;
  quarter: number; // 1, 2, 3, 4
  month?: number; // 1-12
  startDate: Date;
  endDate: Date;
  status: PeriodStatus;
  closedBy?: mongoose.Types.ObjectId;
  closedAt?: Date;
  reopenedBy?: mongoose.Types.ObjectId;
  reopenedAt?: Date;
  reopenReason?: string;
  closingNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FiscalPeriodSchema = new Schema<IFiscalPeriod>(
  {
    tenantId: { type: String, required: true, default: 'default', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    periodCode: { type: String, required: true, index: true },
    name: { type: String, required: true },
    year: { type: Number, required: true, index: true },
    quarter: { type: Number, required: true, min: 1, max: 4, index: true },
    month: { type: Number, min: 1, max: 12 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED', 'LOCKED', 'AUDITED'],
      required: true,
      default: 'OPEN',
      index: true,
    },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
    reopenedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reopenedAt: { type: Date },
    reopenReason: { type: String },
    closingNotes: { type: String },
  },
  { timestamps: true }
);

FiscalPeriodSchema.index({ tenantId: 1, periodCode: 1 }, { unique: true });
FiscalPeriodSchema.index({ tenantId: 1, year: 1, month: 1 });
FiscalPeriodSchema.index({ tenantId: 1, status: 1 });

export const FiscalPeriod = mongoose.model<IFiscalPeriod>('FiscalPeriod', FiscalPeriodSchema);
