import mongoose, { Schema, type Document } from 'mongoose';

export interface IGiftCardTransaction {
  transactionNumber: string;
  type: 'ISSUE' | 'TOPUP' | 'REDEEM' | 'REFUND';
  amount: number; // Positive for issue/topup/refund, negative for redeem
  balanceAfter: number;
  note?: string;
  createdAt: Date;
}

export interface IGiftCard extends Document {
  code: string;
  pinCode?: string; // Optional 4-digit PIN for security
  initialBalance: number;
  balance: number;
  isActive: boolean;
  expiresAt: Date;
  issuedToCustomer?: mongoose.Types.ObjectId;
  purchasedByName?: string;
  transactions: IGiftCardTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const GiftCardTransactionSchema = new Schema<IGiftCardTransaction>({
  transactionNumber: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['ISSUE', 'TOPUP', 'REDEEM', 'REFUND'],
    default: 'ISSUE',
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  note: { type: String },
  createdAt: { type: Date, required: true, default: Date.now },
});

const GiftCardSchema = new Schema<IGiftCard>(
  {
    code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    pinCode: { type: String },
    initialBalance: { type: Number, required: true, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, required: true },
    issuedToCustomer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    purchasedByName: { type: String, trim: true },
    transactions: [GiftCardTransactionSchema],
  },
  { timestamps: true }
);

GiftCardSchema.index({ expiresAt: 1, isActive: 1 });

export const GiftCard = mongoose.model<IGiftCard>('GiftCard', GiftCardSchema);
