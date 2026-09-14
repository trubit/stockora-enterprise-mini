import mongoose, { Schema, type Document } from 'mongoose';

export type ImportDataType =
  | 'products'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'employees'
  | 'opening_stock'
  | 'price_lists';

export interface ImportErrorItem {
  row: number;
  field?: string;
  value?: any;
  error: string;
  suggestion?: string;
}

export interface IImportJob extends Omit<Document, 'errors'> {
  tenantId: string;
  type: ImportDataType;
  fileName: string;
  fileSize: number;
  format: 'CSV' | 'JSON' | 'XLSX';
  status:
    'PENDING' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  processedRows: number;
  progressPercent: number;
  columnMapping?: Record<string, string>;
  previewData?: Array<Record<string, any>>;
  errors: ImportErrorItem[];
  resultSummary?: {
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    durationMs: number;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImportJobSchema = new Schema<IImportJob>(
  {
    tenantId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      index: true,
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    format: { type: String, enum: ['CSV', 'JSON', 'XLSX'], default: 'CSV' },
    status: {
      type: String,
      enum: [
        'PENDING',
        'VALIDATING',
        'VALIDATED',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'ROLLED_BACK',
      ],
      default: 'PENDING',
      index: true,
    },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    progressPercent: { type: Number, default: 0 },
    columnMapping: { type: Schema.Types.Mixed, default: {} },
    previewData: { type: [Schema.Types.Mixed], default: [] },
    errors: [
      {
        row: { type: Number, required: true },
        field: { type: String },
        value: { type: Schema.Types.Mixed },
        error: { type: String, required: true },
        suggestion: { type: String },
      },
    ],
    resultSummary: {
      createdCount: { type: Number, default: 0 },
      updatedCount: { type: Number, default: 0 },
      skippedCount: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

ImportJobSchema.index({ tenantId: 1, createdAt: -1 });

export const ImportJob = mongoose.model<IImportJob>('ImportJob', ImportJobSchema);
