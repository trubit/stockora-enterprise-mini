import mongoose, { Schema, type Document } from 'mongoose';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PENDING' | 'CANCELLED';

export interface ITenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  invoiceHeader?: string;
  invoiceFooter?: string;
  posBannerUrl?: string;
}

export interface ITenantContact {
  email: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ITenantTaxConfig {
  taxId?: string;
  taxRegistrationName?: string;
  defaultTaxRate?: number;
  isTaxInclusive?: boolean;
  taxExemptionAllowed?: boolean;
}

export interface ITenantFiscalConfig {
  fiscalYearStartMonth?: number; // 1-12
  currency: string;
  currencySymbol?: string;
  timezone: string;
  locale: string;
  dateFormat?: string;
  numberFormat?: string;
}

export interface ITenantLimits {
  maxUsers: number;
  maxBranches: number;
  maxWarehouses: number;
  maxPOSTerminals: number;
  maxProducts: number;
  maxStorageMb: number;
}

export interface ITenant extends Document {
  name: string;
  legalName?: string;
  slug: string;
  status: TenantStatus;
  businessType: string; // Retail, Wholesale, Manufacturing, Services, Pharmacy, etc.
  industry?: string;
  logoUrl?: string;
  branding: ITenantBranding;
  contact: ITenantContact;
  taxConfig: ITenantTaxConfig;
  fiscalConfig: ITenantFiscalConfig;
  features: Map<string, boolean>;
  limits: ITenantLimits;
  subscriptionTier:
    'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';
  subscriptionReference?: string;
  onboardingCompleted: boolean;
  onboardingStep?: number;
  ownerUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TenantBrandingSchema = new Schema<ITenantBranding>(
  {
    primaryColor: { type: String, default: '#6366f1' },
    secondaryColor: { type: String, default: '#4f46e5' },
    accentColor: { type: String, default: '#10b981' },
    logoUrl: { type: String },
    faviconUrl: { type: String },
    receiptHeader: { type: String },
    receiptFooter: { type: String },
    invoiceHeader: { type: String },
    invoiceFooter: { type: String },
    posBannerUrl: { type: String },
  },
  { _id: false }
);

const TenantContactSchema = new Schema<ITenantContact>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String },
    website: { type: String },
    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
  },
  { _id: false }
);

const TenantTaxConfigSchema = new Schema<ITenantTaxConfig>(
  {
    taxId: { type: String, trim: true },
    taxRegistrationName: { type: String, trim: true },
    defaultTaxRate: { type: Number, default: 0.075 },
    isTaxInclusive: { type: Boolean, default: false },
    taxExemptionAllowed: { type: Boolean, default: true },
  },
  { _id: false }
);

const TenantFiscalConfigSchema = new Schema<ITenantFiscalConfig>(
  {
    fiscalYearStartMonth: { type: Number, default: 1 },
    currency: { type: String, default: 'USD', uppercase: true },
    currencySymbol: { type: String, default: '$' },
    timezone: { type: String, default: 'UTC' },
    locale: { type: String, default: 'en-US' },
    dateFormat: { type: String, default: 'YYYY-MM-DD' },
    numberFormat: { type: String, default: 'standard' },
  },
  { _id: false }
);

const TenantLimitsSchema = new Schema<ITenantLimits>(
  {
    maxUsers: { type: Number, default: 1 },
    maxBranches: { type: Number, default: 1 },
    maxWarehouses: { type: Number, default: 1 },
    maxPOSTerminals: { type: Number, default: 1 },
    maxProducts: { type: Number, default: 50 },
    maxStorageMb: { type: Number, default: 512 },
  },
  { _id: false }
);

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'TRIAL', 'PENDING', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    businessType: { type: String, default: 'Retail', trim: true },
    industry: { type: String, trim: true },
    logoUrl: { type: String },
    branding: { type: TenantBrandingSchema, default: () => ({}) },
    contact: { type: TenantContactSchema, required: true },
    taxConfig: { type: TenantTaxConfigSchema, default: () => ({}) },
    fiscalConfig: { type: TenantFiscalConfigSchema, default: () => ({}) },
    features: {
      type: Map,
      of: Boolean,
      default: () =>
        new Map([
          ['pos', true],
          ['inventory', true],
          ['loyalty', false],
          ['crm', false],
          ['aiAssistant', false],
          ['advancedAnalytics', false],
          ['wholesale', false],
          ['creditSales', false],
          ['multiBranch', false],
          ['procurement', false],
          ['warehousing', false],
        ]),
    },
    limits: { type: TenantLimitsSchema, default: () => ({}) },
    subscriptionTier: {
      type: String,
      enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'GROWTH', 'ENTERPRISE', 'CUSTOM'],
      default: 'FREE',
      index: true,
    },
    subscriptionReference: { type: String },
    onboardingCompleted: { type: Boolean, default: false, index: true },
    onboardingStep: { type: Number, default: 1 },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Indexes for high performance tenant query execution
TenantSchema.index({ status: 1, createdAt: -1 });
TenantSchema.index({ 'contact.email': 1 });

TenantSchema.pre(['deleteMany', 'deleteOne', 'findOneAndDelete'], function (this: any) {
  const dbName = this.mongooseCollection?.conn?.name || this.model?.db?.name;
  const filter = this.getFilter();
  const isUnconstrained = !filter || Object.keys(filter).length === 0;

  if ((dbName === 'stockora' || dbName === 'stockora_mini_database') && isUnconstrained) {
    throw new Error(
      'CRITICAL SAFETY GUARD: Unconstrained deletion of Tenant documents on production databases is strictly forbidden to protect enterprise tenant accounts.'
    );
  }
});

export const Tenant: mongoose.Model<ITenant> =
  (mongoose.models.Tenant as mongoose.Model<ITenant>) ||
  mongoose.model<ITenant>('Tenant', TenantSchema);
