import mongoose, { Schema, type Document } from 'mongoose';

export interface IMasterData extends Document {
  type: 'CATEGORY' | 'BRAND' | 'UOM' | 'TAX_RATE' | 'CUSTOMER_TYPE' | 'SUPPLIER_TYPE';
  name: string;
  code: string;
  value?: string | number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MasterDataSchema = new Schema<IMasterData>(
  {
    type: {
      type: String,
      required: true,
      enum: ['CATEGORY', 'BRAND', 'UOM', 'TAX_RATE', 'CUSTOMER_TYPE', 'SUPPLIER_TYPE'],
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    value: { type: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

MasterDataSchema.index({ type: 1, code: 1 }, { unique: true });

export const MasterData = mongoose.model<IMasterData>('MasterData', MasterDataSchema);
