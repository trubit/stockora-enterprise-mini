import mongoose, { Schema, type Document } from 'mongoose';

export interface IExchangeRate extends Document {
  tenantId?: mongoose.Types.ObjectId;
  code: string; // Target currency code e.g. 'EUR', 'GBP', 'NGN'
  baseCurrency: string; // e.g. 'USD'
  symbol: string; // e.g. '€', '£', '₦'
  rate: number; // conversion factor: 1 baseCurrency = X targetCurrency
  provider: string; // 'OpenExchangeRates', 'ECB', 'CentralBankOfNigeria', 'Manual'
  fetchedAt: Date;
  isCustomOverride?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExchangeRateSchema = new Schema<IExchangeRate>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    baseCurrency: { type: String, required: true, default: 'USD', uppercase: true, trim: true },
    symbol: { type: String, required: true },
    rate: { type: Number, required: true, min: 0 },
    provider: { type: String, default: 'CentralBankOfNigeria' },
    fetchedAt: { type: Date, default: Date.now },
    isCustomOverride: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ExchangeRateSchema.index({ tenantId: 1, baseCurrency: 1, code: 1 });

export const ExchangeRate: mongoose.Model<IExchangeRate> =
  mongoose.models.ExchangeRate || mongoose.model<IExchangeRate>('ExchangeRate', ExchangeRateSchema);
