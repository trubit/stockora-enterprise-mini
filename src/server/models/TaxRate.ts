import mongoose, { Schema, Document } from 'mongoose';

export interface ITaxRate extends Document {
  tenantId?: string;
  name: string;
  code: string;
  ratePercentage: number;
  type: 'SALES_TAX' | 'VAT' | 'CUSTOMS' | 'OTHER';
  isInclusive: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaxRateSchema = new Schema<ITaxRate>(
  {
    tenantId: { type: String, index: true },
    name: { type: String, required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    ratePercentage: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ['SALES_TAX', 'VAT', 'CUSTOMS', 'OTHER'],
      required: true,
      default: 'VAT',
    },
    isInclusive: { type: Boolean, required: true, default: false },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const TaxRate = mongoose.model<ITaxRate>('TaxRate', TaxRateSchema);
