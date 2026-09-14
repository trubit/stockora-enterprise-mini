import mongoose, { Schema, type Document } from 'mongoose';

export type ForecastPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
export type ForecastMethod =
  | 'MOVING_AVERAGE'
  | 'WEIGHTED_MOVING_AVERAGE'
  | 'EXPONENTIAL_SMOOTHING'
  | 'SEASONAL_TREND'
  | 'AI_HYBRID';

export interface IInventoryForecast extends Document {
  tenantId?: string;
  companyId?: string;
  branchId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  productSku?: string;
  productName?: string;
  period: ForecastPeriod;
  forecastPeriodStart: Date;
  forecastPeriodEnd: Date;
  forecastedDemand: number;
  confidenceScore: number; // 0 - 100
  historicalAccuracy: {
    mae: number; // Mean Absolute Error
    mape: number; // Mean Absolute Percentage Error (%)
    bias: number; // Forecast Bias
    sampleSize: number;
  };
  method: ForecastMethod;
  parameters?: Record<string, unknown>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryForecastSchema = new Schema<IInventoryForecast>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    companyId: { type: String, index: true, default: 'default' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productSku: { type: String, index: true },
    productName: { type: String },
    period: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'],
      required: true,
      default: 'MONTHLY',
    },
    forecastPeriodStart: { type: Date, required: true },
    forecastPeriodEnd: { type: Date, required: true },
    forecastedDemand: { type: Number, required: true, min: 0 },
    confidenceScore: { type: Number, required: true, min: 0, max: 100, default: 85 },
    historicalAccuracy: {
      mae: { type: Number, default: 0 },
      mape: { type: Number, default: 0 },
      bias: { type: Number, default: 0 },
      sampleSize: { type: Number, default: 0 },
    },
    method: {
      type: String,
      enum: [
        'MOVING_AVERAGE',
        'WEIGHTED_MOVING_AVERAGE',
        'EXPONENTIAL_SMOOTHING',
        'SEASONAL_TREND',
        'AI_HYBRID',
      ],
      required: true,
      default: 'WEIGHTED_MOVING_AVERAGE',
    },
    parameters: { type: Schema.Types.Mixed },
    notes: { type: String },
  },
  { timestamps: true }
);

InventoryForecastSchema.index({ productId: 1, period: 1, forecastPeriodStart: -1 });

export const InventoryForecast = mongoose.model<IInventoryForecast>(
  'InventoryForecast',
  InventoryForecastSchema
);
