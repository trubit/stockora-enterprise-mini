import mongoose, { Schema, type Document } from 'mongoose';

export interface IWarrantyClaim {
  claimNumber: string;
  claimDate: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  issueDescription: string;
  resolutionNotes?: string;
  actionTaken?: 'REPAIR' | 'REPLACEMENT' | 'REFUND' | 'REJECTED';
  resolvedAt?: Date;
}

export interface IWarranty extends Document {
  warrantyNumber: string;
  productId: mongoose.Types.ObjectId;
  productName: string;
  serialNumber: string;
  customerName: string;
  customerEmail: string;
  registeredAt: Date;
  durationMonths: number;
  expiresAt: Date;
  claims: IWarrantyClaim[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WarrantyClaimSchema = new Schema<IWarrantyClaim>({
  claimNumber: { type: String, required: true },
  claimDate: { type: Date, required: true, default: Date.now },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
    default: 'PENDING',
  },
  issueDescription: { type: String, required: true },
  resolutionNotes: { type: String },
  actionTaken: { type: String, enum: ['REPAIR', 'REPLACEMENT', 'REFUND', 'REJECTED'] },
  resolvedAt: { type: Date },
});

const WarrantySchema = new Schema<IWarranty>(
  {
    warrantyNumber: { type: String, required: true, unique: true, index: true, uppercase: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    serialNumber: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    registeredAt: { type: Date, required: true, default: Date.now },
    durationMonths: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, required: true },
    claims: [WarrantyClaimSchema],
    notes: { type: String },
  },
  { timestamps: true }
);

export const Warranty = mongoose.model<IWarranty>('Warranty', WarrantySchema);
