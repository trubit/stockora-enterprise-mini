import mongoose, { Schema, type Document } from 'mongoose';

export interface ICompany extends Document {
  tenantId?: mongoose.Types.ObjectId;
  name: string;
  legalName?: string;
  slug?: string;
  logoUrl?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency: string;
  timeZone: string;
  locale?: string;
  businessType?: string;
  industry?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    slug: { type: String, trim: true, lowercase: true, index: true },
    logoUrl: { type: String },
    taxId: { type: String, trim: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String, lowercase: true, trim: true },
    website: { type: String },
    currency: { type: String, default: 'USD' },
    timeZone: { type: String, default: 'UTC' },
    locale: { type: String, default: 'en-US' },
    businessType: { type: String, default: 'Retail' },
    industry: { type: String },
  },
  { timestamps: true }
);

export const Company: mongoose.Model<ICompany> =
  (mongoose.models.Company as mongoose.Model<ICompany>) ||
  mongoose.model<ICompany>('Company', CompanySchema);
