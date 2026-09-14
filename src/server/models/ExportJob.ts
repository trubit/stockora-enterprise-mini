import mongoose, { Schema, type Document } from 'mongoose';

export type ExportResourceType =
  | 'products'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'orders'
  | 'transactions'
  | 'financial_reports'
  | 'audit_logs';

export interface IExportJob extends Document {
  tenantId: string;
  resourceType: ExportResourceType;
  format: 'CSV' | 'JSON' | 'XLSX';
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  recordCount: number;
  fileUrl?: string;
  fileSize?: number;
  downloadToken?: string;
  filters?: Record<string, any>;
  expiresAt: Date;
  errorMessage?: string;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExportJobSchema = new Schema<IExportJob>(
  {
    tenantId: { type: String, required: true, index: true },
    resourceType: {
      type: String,
      required: true,
      index: true,
    },
    format: { type: String, enum: ['CSV', 'JSON', 'XLSX'], default: 'CSV' },
    status: {
      type: String,
      enum: ['PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    recordCount: { type: Number, default: 0 },
    fileUrl: { type: String },
    fileSize: { type: Number },
    downloadToken: { type: String, index: true },
    filters: { type: Schema.Types.Mixed, default: {} },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
    },
    errorMessage: { type: String },
    requestedBy: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically remove expired export records after 7 days
ExportJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
ExportJobSchema.index({ tenantId: 1, createdAt: -1 });

export const ExportJob = mongoose.model<IExportJob>('ExportJob', ExportJobSchema);
