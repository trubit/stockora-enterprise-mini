import mongoose, { Schema, type Document } from 'mongoose';

export interface IScheduledReport extends Document {
  savedReportId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  cronExpression: string; // e.g. "0 9 * * *" for daily at 9am
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
  recipients: string[];
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledReportSchema = new Schema<IScheduledReport>(
  {
    savedReportId: { type: Schema.Types.ObjectId, ref: 'SavedReport', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, index: true },
    cronExpression: { type: String, required: true },
    format: { type: String, required: true, enum: ['PDF', 'EXCEL', 'CSV', 'JSON'] },
    recipients: { type: [String], required: true },
    isActive: { type: Boolean, default: true, index: true },
    lastRunAt: { type: Date },
    nextRunAt: { type: Date },
  },
  { timestamps: true }
);

export const ScheduledReport = mongoose.model<IScheduledReport>(
  'ScheduledReport',
  ScheduledReportSchema
);
