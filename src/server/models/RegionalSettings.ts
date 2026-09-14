import mongoose, { Schema, type Document } from 'mongoose';

export interface ITaxRateItem {
  name: string;
  code: string;
  ratePercentage: number;
  type: 'VAT' | 'SALES_TAX' | 'GST' | 'CUSTOMS' | 'EXEMPT';
  category: 'STANDARD' | 'REDUCED' | 'ZERO_RATED' | 'EXEMPT';
  isInclusive: boolean;
  isActive: boolean;
  description?: string;
}

export interface ITaxConfiguration {
  taxId?: string;
  taxRegistrationName?: string;
  taxType: 'VAT' | 'SALES_TAX' | 'GST' | 'EXEMPT';
  defaultTaxRate: number;
  isTaxInclusive: boolean;
  taxExemptionAllowed: boolean;
  taxRates: ITaxRateItem[];
}

export interface IRegionalSettings extends Document {
  tenantId: mongoose.Types.ObjectId;
  country: string;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  supportedCurrencies: string[];
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  numberFormat: {
    decimalSeparator: string;
    thousandSeparator: string;
    precision: number;
  };
  firstDayOfWeek: 'Sunday' | 'Monday';
  measurementSystem: 'Metric' | 'Imperial';
  taxConfig: ITaxConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

const TaxRateItemSchema = new Schema<ITaxRateItem>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    ratePercentage: { type: Number, required: true, min: 0, max: 100 },
    type: {
      type: String,
      enum: ['VAT', 'SALES_TAX', 'GST', 'CUSTOMS', 'EXEMPT'],
      default: 'VAT',
    },
    category: {
      type: String,
      enum: ['STANDARD', 'REDUCED', 'ZERO_RATED', 'EXEMPT'],
      default: 'STANDARD',
    },
    isInclusive: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    description: { type: String },
  },
  { _id: true }
);

const TaxConfigurationSchema = new Schema<ITaxConfiguration>(
  {
    taxId: { type: String, trim: true },
    taxRegistrationName: { type: String, trim: true },
    taxType: {
      type: String,
      enum: ['VAT', 'SALES_TAX', 'GST', 'EXEMPT'],
      default: 'EXEMPT',
    },
    defaultTaxRate: { type: Number, default: 0, min: 0, max: 100 },
    isTaxInclusive: { type: Boolean, default: false },
    taxExemptionAllowed: { type: Boolean, default: true },
    taxRates: { type: [TaxRateItemSchema], default: [] },
  },
  { _id: false }
);

const RegionalSettingsSchema = new Schema<IRegionalSettings>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    country: { type: String, default: 'United States', trim: true },
    countryCode: { type: String, default: 'US', uppercase: true, trim: true },
    currency: { type: String, default: 'USD', uppercase: true, trim: true },
    currencySymbol: { type: String, default: '$' },
    supportedCurrencies: { type: [String], default: ['USD', 'NGN', 'EUR', 'GBP'] },
    timezone: { type: String, default: 'America/New_York', trim: true },
    language: { type: String, default: 'en', trim: true },
    dateFormat: { type: String, default: 'YYYY-MM-DD' },
    timeFormat: { type: String, enum: ['12h', '24h'], default: '12h' },
    numberFormat: {
      decimalSeparator: { type: String, default: '.' },
      thousandSeparator: { type: String, default: ',' },
      precision: { type: Number, default: 2 },
    },
    firstDayOfWeek: { type: String, enum: ['Sunday', 'Monday'], default: 'Monday' },
    measurementSystem: { type: String, enum: ['Metric', 'Imperial'], default: 'Metric' },
    taxConfig: { type: TaxConfigurationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const RegionalSettings: mongoose.Model<IRegionalSettings> =
  mongoose.models.RegionalSettings ||
  mongoose.model<IRegionalSettings>('RegionalSettings', RegionalSettingsSchema);
