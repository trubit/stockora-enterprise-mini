import mongoose, { Schema, type Document } from 'mongoose';

export interface ISalesAssignment extends Document {
  tenantId: string;
  companyId: string;
  customerId: mongoose.Types.ObjectId;
  salesRepId?: string;
  salesRepName?: string;
  territoryId?: mongoose.Types.ObjectId;
  priceListId?: mongoose.Types.ObjectId;
  customerGroup: string;
  commissionRate: number; // percentage e.g. 5 = 5%
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesAssignmentSchema = new Schema<ISalesAssignment>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    companyId: { type: String, required: true, index: true, default: 'default' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    salesRepId: { type: String, index: true },
    salesRepName: { type: String },
    territoryId: { type: Schema.Types.ObjectId, ref: 'SalesTerritory', index: true },
    priceListId: { type: Schema.Types.ObjectId, ref: 'PriceList' },
    customerGroup: { type: String, required: true, default: 'RETAIL' },
    commissionRate: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String },
  },
  { timestamps: true }
);

SalesAssignmentSchema.index({ tenantId: 1, companyId: 1, customerId: 1 }, { unique: true });

export const SalesAssignment = mongoose.model<ISalesAssignment>(
  'SalesAssignment',
  SalesAssignmentSchema
);
