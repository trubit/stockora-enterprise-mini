import mongoose, { Schema, type Document } from 'mongoose';

export interface ITelemetryMetric extends Document {
  metricName: string;
  value: number;
  labels: Record<string, string>;
  createdAt: Date;
}

const TelemetryMetricSchema = new Schema<ITelemetryMetric>({
  metricName: { type: String, required: true, index: true },
  value: { type: Number, required: true },
  labels: { type: Schema.Types.Map, of: String, default: {} },
  createdAt: { type: Date, default: Date.now },
});

// Configure TTL index for telemetry: auto-cleanup logs after 30 days
TelemetryMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const TelemetryMetric =
  mongoose.models.TelemetryMetric ||
  mongoose.model<ITelemetryMetric>('TelemetryMetric', TelemetryMetricSchema);
