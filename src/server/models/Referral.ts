import mongoose, { Schema, type Document } from 'mongoose';

export type ReferralStatus = 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'EXPIRED' | 'REJECTED_FRAUD';

export interface IReferral extends Document {
  tenantId: string;
  referrerId: mongoose.Types.ObjectId;
  referrerName: string;
  referrerEmail: string;
  referralCode: string;
  refereeEmail: string;
  refereeId?: mongoose.Types.ObjectId;
  refereeName?: string;
  status: ReferralStatus;
  rewardPoints: number;
  rewardIssuedAt?: Date;
  qualificationOrderId?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    tenantId: { type: String, required: true, index: true, default: 'default' },
    referrerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    referrerName: { type: String, required: true },
    referrerEmail: { type: String, required: true },
    referralCode: { type: String, required: true, index: true },
    refereeEmail: { type: String, required: true, lowercase: true, trim: true },
    refereeId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    refereeName: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'QUALIFIED', 'REWARDED', 'EXPIRED', 'REJECTED_FRAUD'],
      default: 'PENDING',
      index: true,
    },
    rewardPoints: { type: Number, default: 250, min: 0 },
    rewardIssuedAt: { type: Date },
    qualificationOrderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

ReferralSchema.index({ tenantId: 1, referralCode: 1, refereeEmail: 1 }, { unique: true });

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
