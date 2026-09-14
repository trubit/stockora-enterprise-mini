import mongoose, { Schema, type Document } from 'mongoose';

export type PlanTier =
  'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';
export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type PlanStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';

export interface IPlanLimit {
  count: number;
  unlimited: boolean;
}

export interface IPlanLimits {
  users: IPlanLimit;
  branches: IPlanLimit;
  warehouses: IPlanLimit;
  posTerminals: IPlanLimit;
  products: IPlanLimit;
  customers: IPlanLimit;
  orders: IPlanLimit;
  storageMb: IPlanLimit;
  apiRequestsMonthly: IPlanLimit;
  aiRequestsMonthly: IPlanLimit;
  automations: IPlanLimit;
}

export interface IPlanFeatures {
  pos: boolean;
  inventory: boolean;
  advancedInventory: boolean;
  crm: boolean;
  loyalty: boolean;
  aiAssistant: boolean;
  advancedAnalytics: boolean;
  multiBranch: boolean;
  warehouseManagement: boolean;
  employeeManagement: boolean;
  reports: boolean;
  apiAccess: boolean;
  integrations: boolean;
  automation: boolean;
  customBranding: boolean;
  prioritySupport: boolean;
}

export interface ITrialConfig {
  trialDays: number;
  isTrialEnabled: boolean;
}

export interface IPlan extends Document {
  name: string;
  slug: string;
  tier: PlanTier;
  description: string;
  status: PlanStatus;
  billingInterval: BillingInterval;
  price: number; // In base currency (e.g. NGN 25000 or USD 30)
  yearlyDiscountPercent: number; // e.g. 20% discount on yearly
  currency: string; // 'NGN', 'USD'
  features: IPlanFeatures;
  limits: IPlanLimits;
  trialConfiguration: ITrialConfig;
  version: number;
  isPopular?: boolean;
  isCustom?: boolean;
  sortOrder: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PlanLimitSchema = new Schema<IPlanLimit>(
  {
    count: { type: Number, required: true, default: 0 },
    unlimited: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const PlanLimitsSchema = new Schema<IPlanLimits>(
  {
    users: { type: PlanLimitSchema, default: () => ({ count: 5, unlimited: false }) },
    branches: { type: PlanLimitSchema, default: () => ({ count: 1, unlimited: false }) },
    warehouses: { type: PlanLimitSchema, default: () => ({ count: 1, unlimited: false }) },
    posTerminals: { type: PlanLimitSchema, default: () => ({ count: 2, unlimited: false }) },
    products: { type: PlanLimitSchema, default: () => ({ count: 500, unlimited: false }) },
    customers: { type: PlanLimitSchema, default: () => ({ count: 1000, unlimited: false }) },
    orders: { type: PlanLimitSchema, default: () => ({ count: 1000, unlimited: false }) },
    storageMb: { type: PlanLimitSchema, default: () => ({ count: 1024, unlimited: false }) },
    apiRequestsMonthly: {
      type: PlanLimitSchema,
      default: () => ({ count: 5000, unlimited: false }),
    },
    aiRequestsMonthly: { type: PlanLimitSchema, default: () => ({ count: 100, unlimited: false }) },
    automations: { type: PlanLimitSchema, default: () => ({ count: 5, unlimited: false }) },
  },
  { _id: false }
);

const PlanFeaturesSchema = new Schema<IPlanFeatures>(
  {
    pos: { type: Boolean, default: true },
    inventory: { type: Boolean, default: true },
    advancedInventory: { type: Boolean, default: false },
    crm: { type: Boolean, default: false },
    loyalty: { type: Boolean, default: false },
    aiAssistant: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    multiBranch: { type: Boolean, default: false },
    warehouseManagement: { type: Boolean, default: false },
    employeeManagement: { type: Boolean, default: true },
    reports: { type: Boolean, default: true },
    apiAccess: { type: Boolean, default: false },
    integrations: { type: Boolean, default: false },
    automation: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
  },
  { _id: false }
);

const TrialConfigSchema = new Schema<ITrialConfig>(
  {
    trialDays: { type: Number, default: 14 },
    isTrialEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const PlanSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tier: {
      type: String,
      enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'GROWTH', 'ENTERPRISE', 'CUSTOM'],
      required: true,
      default: 'STARTER',
      index: true,
    },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'DRAFT'],
      default: 'ACTIVE',
      index: true,
    },
    billingInterval: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      default: 'MONTHLY',
    },
    price: { type: Number, required: true, min: 0 },
    yearlyDiscountPercent: { type: Number, default: 20, min: 0, max: 100 },
    currency: { type: String, required: true, default: 'NGN', uppercase: true },
    features: { type: PlanFeaturesSchema, required: true, default: () => ({}) },
    limits: { type: PlanLimitsSchema, required: true, default: () => ({}) },
    trialConfiguration: { type: TrialConfigSchema, required: true, default: () => ({}) },
    version: { type: Number, required: true, default: 1 },
    isPopular: { type: Boolean, default: false },
    isCustom: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

PlanSchema.index({ slug: 1, version: 1 });
PlanSchema.index({ status: 1, sortOrder: 1 });

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
