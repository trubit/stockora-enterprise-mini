import mongoose, { Schema, type Document } from 'mongoose';

export interface ISavedReport extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  templateId: mongoose.Types.ObjectId;
  configuration: {
    fields: string[];
    filters: Record<string, unknown>;
    groupings: string[];
    sorting: Record<string, 'asc' | 'desc'>;
    aggregations: { field: string; type: 'sum' | 'avg' | 'min' | 'max' | 'count' }[];
    chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'area';
  };
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SavedReportSchema = new Schema<ISavedReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'ReportTemplate', required: true, index: true },
    configuration: {
      fields: { type: [String], required: true },
      filters: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
      groupings: { type: [String], default: [] },
      sorting: { type: Schema.Types.Map, of: String, default: {} },
      aggregations: {
        type: [
          {
            field: { type: String, required: true },
            type: { type: String, required: true, enum: ['sum', 'avg', 'min', 'max', 'count'] },
          },
        ],
        default: [],
      },
      chartType: { type: String, enum: ['line', 'bar', 'pie', 'donut', 'area'] },
    },
    isFavorite: { type: Boolean, default: false, index: true },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const SavedReport = mongoose.model<ISavedReport>('SavedReport', SavedReportSchema);
