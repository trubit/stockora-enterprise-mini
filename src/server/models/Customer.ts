import mongoose, { Schema, type Document } from 'mongoose';

export interface ILoyaltyHistoryEntry {
  date: Date;
  points: number; // Positive = earned, negative = spent/expired
  reason: string;
  referenceId?: string; // Transaction or promo reference
}

export type ChurnRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type LoyaltyTierType = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface ICustomerPreferences {
  preferredCategories?: string[];
  preferredProducts?: string[];
  preferredChannel?: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';
  preferredLanguage?: string;
}

export interface ICommunicationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  whatsapp: boolean;
}

export interface ICustomer extends Document {
  tenantId: string;
  companyId?: string;
  branchId?: mongoose.Types.ObjectId;
  name: string;
  code: string;
  email: string;
  phone?: string;
  group: string;
  customerType?: 'RETAIL' | 'WHOLESALE' | 'B2B' | 'VIP';
  creditLimit: number;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTierType;
  loyaltyHistory: ILoyaltyHistoryEntry[];
  birthday?: Date;
  referralCode?: string;
  referredBy?: string;
  referralCount: number;
  billingAddress?: string;
  shippingAddress?: string;
  isActive: boolean;
  notes?: string;

  // CRM Analytics & Retention
  totalSpending: number;
  totalOrders: number;
  avgOrderValue: number;
  lastPurchaseDate?: Date;
  firstPurchaseDate?: Date;
  returnsCount: number;
  refundsTotal: number;
  clvScore: number; // Estimated Customer Lifetime Value
  clvConfidence?: number; // 0 - 100
  clvMethod?: string; // e.g. "HISTORICAL_MARGIN_MULTIPLIER"
  engagementScore: number; // 0 - 100
  churnRiskScore: number; // 0 - 100
  churnRiskLevel: ChurnRiskLevel;
  churnSignals?: string[];
  tags: string[];

  // Preferences & Consent
  preferences?: ICustomerPreferences;
  communicationPreferences?: ICommunicationPreferences;
  optInMarketing: boolean;
  optInSms: boolean;
  optInWhatsapp: boolean;
  consentDate?: Date;
  consentVersion?: string;
  balance?: number;
  // Tax & Exemption
  isTaxExempt?: boolean;
  taxExemptionNumber?: string;

  createdAt: Date;
  updatedAt: Date;
}

const LoyaltyHistorySchema = new Schema<ILoyaltyHistoryEntry>({
  date: { type: Date, required: true, default: Date.now },
  points: { type: Number, required: true },
  reason: { type: String, required: true },
  referenceId: { type: String },
});

const CustomerSchema = new Schema<ICustomer>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, index: true, default: 'default' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    group: { type: String, required: true, default: 'RETAIL', index: true },
    customerType: {
      type: String,
      enum: ['RETAIL', 'WHOLESALE', 'B2B', 'VIP'],
      default: 'RETAIL',
      index: true,
    },
    creditLimit: { type: Number, required: true, default: 0, min: 0 },
    loyaltyPoints: { type: Number, required: true, default: 0, min: 0 },
    loyaltyTier: {
      type: String,
      required: true,
      enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
      default: 'BRONZE',
      index: true,
    },
    loyaltyHistory: { type: [LoyaltyHistorySchema], default: [] },
    birthday: { type: Date },
    referralCode: { type: String, sparse: true },
    referredBy: { type: String },
    referralCount: { type: Number, default: 0, min: 0 },
    billingAddress: { type: String, trim: true },
    shippingAddress: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String },

    // CRM Metrics
    totalSpending: { type: Number, default: 0, min: 0 },
    totalOrders: { type: Number, default: 0, min: 0 },
    avgOrderValue: { type: Number, default: 0, min: 0 },
    lastPurchaseDate: { type: Date, index: true },
    firstPurchaseDate: { type: Date },
    returnsCount: { type: Number, default: 0, min: 0 },
    refundsTotal: { type: Number, default: 0, min: 0 },
    clvScore: { type: Number, default: 0, min: 0 },
    clvConfidence: { type: Number, default: 85 },
    clvMethod: { type: String, default: 'HISTORICAL_MARGIN_MULTIPLIER' },
    engagementScore: { type: Number, default: 75, min: 0, max: 100 },
    churnRiskScore: { type: Number, default: 15, min: 0, max: 100 },
    churnRiskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
      index: true,
    },
    churnSignals: [{ type: String }],
    tags: [{ type: String, index: true }],

    // Preferences & Consent
    preferences: {
      preferredCategories: [{ type: String }],
      preferredProducts: [{ type: String }],
      preferredChannel: {
        type: String,
        enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'],
        default: 'EMAIL',
      },
      preferredLanguage: { type: String, default: 'en' },
    },
    communicationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },
    optInMarketing: { type: Boolean, default: true },
    optInSms: { type: Boolean, default: true },
    optInWhatsapp: { type: Boolean, default: true },
    consentDate: { type: Date, default: Date.now },
    consentVersion: { type: String, default: 'v1.0' },
    isTaxExempt: { type: Boolean, default: false },
    taxExemptionNumber: { type: String, trim: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ tenantId: 1, code: 1 }, { unique: true });
CustomerSchema.index({ tenantId: 1, email: 1 }, { unique: true });
CustomerSchema.index({ tenantId: 1, loyaltyTier: 1, churnRiskLevel: 1 });
CustomerSchema.index({ tenantId: 1, totalSpending: -1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
