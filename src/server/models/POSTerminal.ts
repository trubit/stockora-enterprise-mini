import mongoose, { Schema, type Document } from 'mongoose';

export type POSTerminalStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'LOCKED' | 'OFFLINE';

export interface IPOSTerminal extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  storeId?: mongoose.Types.ObjectId;
  terminalCode: string;
  name: string;
  status: POSTerminalStatus;
  assignedUserId?: mongoose.Types.ObjectId;
  assignedUserName?: string;
  hardwareConfig?: {
    receiptPrinterIp?: string;
    barcodeScannerEnabled?: boolean;
    poleDisplayEnabled?: boolean;
    cashDrawerPin?: string;
  };
  lastActiveAt?: Date;
  ipAddress?: string;
  macAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const POSTerminalSchema = new Schema<IPOSTerminal>(
  {
    tenantId: { type: String, index: true, default: 'default' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    terminalCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'LOCKED', 'OFFLINE'],
      default: 'ACTIVE',
      index: true,
    },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedUserName: { type: String },
    hardwareConfig: {
      receiptPrinterIp: { type: String },
      barcodeScannerEnabled: { type: Boolean, default: true },
      poleDisplayEnabled: { type: Boolean, default: false },
      cashDrawerPin: { type: String },
    },
    lastActiveAt: { type: Date, default: Date.now },
    ipAddress: { type: String },
    macAddress: { type: String },
  },
  { timestamps: true }
);

export const POSTerminal =
  mongoose.models.POSTerminal || mongoose.model<IPOSTerminal>('POSTerminal', POSTerminalSchema);
