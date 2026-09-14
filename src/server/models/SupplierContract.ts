import mongoose, { Schema, type Document } from 'mongoose';

export interface ISupplierContract extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  contractNumber: string;
  title: string;
  startDate: Date;
  endDate: Date;
  terms?: string;
  minimumCommitmentAmount?: number;
  currentCommitmentSpend?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWED';
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierContractSchema = new Schema<ISupplierContract>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    contractNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true, index: true },
    terms: { type: String },
    minimumCommitmentAmount: { type: Number, default: 0, min: 0 },
    currentCommitmentSpend: { type: Number, default: 0, min: 0 },
    paymentTerms: { type: String, default: 'NET 30' },
    deliveryTerms: { type: String, default: 'FOB Destination' },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED'],
      default: 'ACTIVE',
      index: true,
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SupplierContract =
  mongoose.models.SupplierContract ||
  mongoose.model<ISupplierContract>('SupplierContract', SupplierContractSchema);
