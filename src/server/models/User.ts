import mongoose, { Schema, type Document } from 'mongoose';
import { PasswordService } from '../services/password.service.js';

export interface IUserTenantMembership {
  tenantId: mongoose.Types.ObjectId;
  tenantSlug?: string;
  tenantName?: string;
  roleName: string;
  branchId?: string;
  allowedBranches?: string[];
  isDefault?: boolean;
  joinedAt: Date;
}

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  roleName: string;
  tenantId?: mongoose.Types.ObjectId;
  tenants: IUserTenantMembership[];
  isPlatformAdmin: boolean;
  isActive: boolean;
  isVerified: boolean;
  failedLoginAttempts: number;
  lockUntil?: Date;
  lastLoginAt?: Date;
  themePreference: 'light' | 'dark';
  preferredLanguage: string;
  timeZone: string;
  avatarUrl?: string;
  branchId?: string;
  allowedBranches?: string[];
  comparePassword: (password: string) => Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserTenantMembershipSchema = new Schema<IUserTenantMembership>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    tenantSlug: { type: String },
    tenantName: { type: String },
    roleName: { type: String, required: true, default: 'Employee' },
    branchId: { type: String },
    allowedBranches: [{ type: String }],
    isDefault: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, trim: true, minlength: 3 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    roleName: { type: String, required: true, default: 'Employee' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
    tenants: [UserTenantMembershipSchema],
    isPlatformAdmin: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isVerified: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
    themePreference: { type: String, enum: ['light', 'dark'], default: 'dark' },
    preferredLanguage: { type: String, default: 'en' },
    timeZone: { type: String, default: 'UTC' },
    avatarUrl: { type: String },
    branchId: { type: String, index: true },
    allowedBranches: [{ type: String }],
  },
  { timestamps: true }
);

UserSchema.index({ 'tenants.tenantId': 1 });

UserSchema.pre(['deleteMany', 'deleteOne', 'findOneAndDelete'], function (this: any) {
  const dbName = this.mongooseCollection?.conn?.name || this.model?.db?.name;
  const filter = this.getFilter();
  const isUnconstrained = !filter || Object.keys(filter).length === 0;

  if ((dbName === 'stockora' || dbName === 'stockora_mini_database') && isUnconstrained) {
    throw new Error(
      'CRITICAL SAFETY GUARD: Unconstrained deletion of User documents on production databases is strictly forbidden to protect user accounts.'
    );
  }
});

UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    this.password = await PasswordService.hashPassword(this.password);
    next();
  } catch (err: unknown) {
    next(err as Error);
  }
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  if (!this.password) return false;
  return PasswordService.comparePassword(password, this.password);
};

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
