import mongoose, { Schema, type Document } from 'mongoose';

export type VerificationPurpose =
  | 'EMAIL_VERIFICATION'
  | 'PASSWORD_RESET'
  | 'EMPLOYEE_INVITATION'
  | 'EMAIL_CHANGE'
  | 'SENSITIVE_ACTION'
  | 'ACCOUNT_RECOVERY'
  | 'MFA';

export interface IVerification extends Document {
  userId?: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  email: string;
  purpose: VerificationPurpose;
  otpHash: string;
  expiresAt: Date;
  attemptCount: number;
  maxAttempts: number;
  lastSentAt: Date;
  verifiedAt?: Date;
  isConsumed: boolean;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  resetTokenConsumed?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationSchema = new Schema<IVerification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: [
        'EMAIL_VERIFICATION',
        'PASSWORD_RESET',
        'EMPLOYEE_INVITATION',
        'EMAIL_CHANGE',
        'SENSITIVE_ACTION',
        'ACCOUNT_RECOVERY',
        'MFA',
      ],
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    verifiedAt: {
      type: Date,
    },
    isConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    resetTokenHash: {
      type: String,
      index: true,
    },
    resetTokenExpiresAt: {
      type: Date,
    },
    resetTokenConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant lookups and security isolation
VerificationSchema.index({ email: 1, purpose: 1, isConsumed: 1 });
VerificationSchema.index({ tenantId: 1, email: 1, purpose: 1 });
VerificationSchema.index({ userId: 1, purpose: 1, isConsumed: 1 });
VerificationSchema.index({ resetTokenHash: 1, isConsumed: 1 });
// Automatic TTL cleanup 24 hours after expiration (allows audit retention buffer while preventing database bloat)
VerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const Verification =
  mongoose.models.Verification || mongoose.model<IVerification>('Verification', VerificationSchema);
