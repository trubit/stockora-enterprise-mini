import mongoose, { Schema, type Document } from 'mongoose';

export interface ISalesTerritory extends Document {
  tenantId: string;
  companyId: string;
  code: string;
  name: string;
  region: string;
  description?: string;
  salesRepIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SalesTerritorySchema = new Schema<ISalesTerritory>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true, index: true },
    description: { type: String },
    salesRepIds: [{ type: String, index: true }],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

SalesTerritorySchema.index({ tenantId: 1, companyId: 1, code: 1 }, { unique: true });

export const SalesTerritory = mongoose.model<ISalesTerritory>(
  'SalesTerritory',
  SalesTerritorySchema
);
