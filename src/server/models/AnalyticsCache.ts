import mongoose, { Schema, type Document } from 'mongoose';

export interface IAnalyticsCache extends Document {
  cacheKey: string;
  data: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsCacheSchema = new Schema<IAnalyticsCache>(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

export const AnalyticsCache = mongoose.model<IAnalyticsCache>(
  'AnalyticsCache',
  AnalyticsCacheSchema
);
