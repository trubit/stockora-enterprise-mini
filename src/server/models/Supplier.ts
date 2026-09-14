import mongoose, { Schema, type Document } from 'mongoose';

export interface ISupplierContact {
  name: string;
  position?: string;
  email: string;
  phone: string;
  department?: string;
  role?: 'SALES' | 'FINANCE' | 'LOGISTICS' | 'MANAGEMENT';
  isPrimary: boolean;
}

export interface ISupplierAddress {
  addressType: 'BILLING' | 'SHIPPING' | 'WAREHOUSE' | 'OFFICE';
  street: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  isPrimary: boolean;
}

export interface ISupplierScorecard {
  onTimeDeliveryRate: number;
  fillRate: number;
  qualityRate: number;
  defectRate: number;
  priceStabilityScore: number;
  averageLeadTimeDays: number;
  overallScore: number;
}

export type SupplierStatus =
  | 'PROSPECT'
  | 'ACTIVE'
  | 'PENDING_APPROVAL'
  | 'SUSPENDED'
  | 'BLACKLISTED'
  | 'INACTIVE'
  | 'ARCHIVED';

export type SupplierCategory =
  | 'MANUFACTURER'
  | 'DISTRIBUTOR'
  | 'WHOLESALER'
  | 'IMPORTER'
  | 'LOCAL'
  | 'INTERNATIONAL'
  | 'SERVICE_PROVIDER';

export interface ISupplier extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  name: string;
  legalName?: string;
  code: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  country?: string;
  state?: string;
  contacts?: ISupplierContact[];
  addresses?: ISupplierAddress[];
  paymentTerms: string;
  creditLimit: number;
  taxId?: string;
  currency: string;
  rating: number;
  category: SupplierCategory;
  status: SupplierStatus;
  scorecard?: ISupplierScorecard;
  leadTimeDays: number;
  moq: number;
  bankAccountDetails?: string;
  documents: string[];
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierContactSchema = new Schema<ISupplierContact>({
  name: { type: String, required: true, trim: true },
  position: { type: String, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  department: { type: String, trim: true },
  role: {
    type: String,
    enum: ['SALES', 'FINANCE', 'LOGISTICS', 'MANAGEMENT'],
    default: 'SALES',
  },
  isPrimary: { type: Boolean, default: false },
});

const SupplierAddressSchema = new Schema<ISupplierAddress>({
  addressType: {
    type: String,
    enum: ['BILLING', 'SHIPPING', 'WAREHOUSE', 'OFFICE'],
    required: true,
  },
  street: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, trim: true },
  country: { type: String, required: true, trim: true },
  postalCode: { type: String, trim: true },
  isPrimary: { type: Boolean, default: false },
});

const SupplierScorecardSchema = new Schema<ISupplierScorecard>({
  onTimeDeliveryRate: { type: Number, default: 100, min: 0, max: 100 },
  fillRate: { type: Number, default: 100, min: 0, max: 100 },
  qualityRate: { type: Number, default: 100, min: 0, max: 100 },
  defectRate: { type: Number, default: 0, min: 0, max: 100 },
  priceStabilityScore: { type: Number, default: 100, min: 0, max: 100 },
  averageLeadTimeDays: { type: Number, default: 7, min: 0 },
  overallScore: { type: Number, default: 100, min: 0, max: 100 },
});

const SupplierSchema = new Schema<ISupplier>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    country: { type: String, trim: true },
    state: { type: String, trim: true },
    contacts: [SupplierContactSchema],
    addresses: [SupplierAddressSchema],
    paymentTerms: { type: String, required: true, default: 'NET 30' },
    creditLimit: { type: Number, required: true, default: 0, min: 0 },
    taxId: { type: String, trim: true },
    currency: { type: String, default: 'USD', uppercase: true, trim: true },
    rating: { type: Number, required: true, default: 5, min: 1, max: 5 },
    category: {
      type: String,
      enum: [
        'MANUFACTURER',
        'DISTRIBUTOR',
        'WHOLESALER',
        'IMPORTER',
        'LOCAL',
        'INTERNATIONAL',
        'SERVICE_PROVIDER',
      ],
      default: 'DISTRIBUTOR',
      index: true,
    },
    status: {
      type: String,
      enum: [
        'PROSPECT',
        'ACTIVE',
        'PENDING_APPROVAL',
        'SUSPENDED',
        'BLACKLISTED',
        'INACTIVE',
        'ARCHIVED',
      ],
      default: 'ACTIVE',
      index: true,
    },
    scorecard: { type: SupplierScorecardSchema, default: () => ({}) },
    leadTimeDays: { type: Number, default: 7, min: 0 },
    moq: { type: Number, default: 1, min: 1 },
    bankAccountDetails: { type: String, select: false },
    documents: [{ type: String }],
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Supplier =
  mongoose.models.Supplier || mongoose.model<ISupplier>('Supplier', SupplierSchema);
