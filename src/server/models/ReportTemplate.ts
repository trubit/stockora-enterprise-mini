import mongoose, { Schema, type Document } from 'mongoose';

export interface IReportTemplate extends Document {
  name: string;
  category:
    | 'INVENTORY'
    | 'SALES'
    | 'PURCHASING'
    | 'FINANCE'
    | 'CUSTOMERS'
    | 'SUPPLIERS'
    | 'EMPLOYEES'
    | 'SYSTEM';
  description: string;
  fields: string[];
  defaultFilters: Record<string, unknown>;
  defaultGroupings: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReportTemplateSchema = new Schema<IReportTemplate>(
  {
    name: { type: String, required: true, index: true },
    category: {
      type: String,
      required: true,
      enum: [
        'INVENTORY',
        'SALES',
        'PURCHASING',
        'FINANCE',
        'CUSTOMERS',
        'SUPPLIERS',
        'EMPLOYEES',
        'SYSTEM',
      ],
      index: true,
    },
    description: { type: String },
    fields: { type: [String], default: [] },
    defaultFilters: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
    defaultGroupings: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const ReportTemplate = mongoose.model<IReportTemplate>(
  'ReportTemplate',
  ReportTemplateSchema
);
