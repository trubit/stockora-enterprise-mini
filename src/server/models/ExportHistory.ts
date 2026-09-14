import mongoose, { Schema, type Document } from 'mongoose';

export interface IExportHistory extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  reportName: string;
  category: string;
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  downloadUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const ExportHistorySchema = new Schema<IExportHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    reportName: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    format: { type: String, required: true, enum: ['PDF', 'EXCEL', 'CSV', 'JSON'], index: true },
    status: { type: String, required: true, enum: ['PENDING', 'SUCCESS', 'FAILED'], index: true },
    downloadUrl: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ExportHistorySchema.index({ createdAt: -1 });

export const ExportHistory = mongoose.model<IExportHistory>('ExportHistory', ExportHistorySchema);
