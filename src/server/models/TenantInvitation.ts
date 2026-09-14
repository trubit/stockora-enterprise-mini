import mongoose, { Schema, type Document } from 'mongoose';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface ITenantInvitation extends Document {
  tenantId: mongoose.Types.ObjectId;
  email: string;
  roleName: string;
  branchId?: mongoose.Types.ObjectId;
  tokenHash: string;
  token?: string; // Legacy optional field
  status: InvitationStatus;
  expiresAt: Date;
  invitedBy: mongoose.Types.ObjectId;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TenantInvitationSchema = new Schema<ITenantInvitation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    roleName: { type: String, required: true, default: 'Employee' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    tokenHash: { type: String, required: true, unique: true, index: true },
    token: { type: String, sparse: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
      default: 'PENDING',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);

TenantInvitationSchema.index({ tenantId: 1, email: 1, status: 1 });
TenantInvitationSchema.index({ tokenHash: 1, status: 1 });

export const TenantInvitation =
  mongoose.models.TenantInvitation ||
  mongoose.model<ITenantInvitation>('TenantInvitation', TenantInvitationSchema);

// Safely drop any legacy unique token index if it exists
if (TenantInvitation.collection) {
  TenantInvitation.collection.dropIndex('token_1').catch(() => {});
}
