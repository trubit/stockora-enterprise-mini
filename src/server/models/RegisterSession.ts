import mongoose, { Schema, type Document } from 'mongoose';

export interface ICashMovement {
  type: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  reason: string;
  performedBy: string;
  createdAt: Date;
}

export interface IRegisterSession extends Document {
  tenantId?: string;
  registerId: string;
  registerName: string;
  branchId: mongoose.Types.ObjectId;
  cashierId: string;
  cashierName: string;
  openingFloat: number;
  closingCash?: number;
  expectedCash: number;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  totalRefunds: number;
  variance: number;
  status: 'OPEN' | 'CLOSED';
  cashMovements: ICashMovement[];
  openedAt: Date;
  closedAt?: Date;
  managerNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CashMovementSchema = new Schema<ICashMovement>({
  type: { type: String, enum: ['CASH_IN', 'CASH_OUT'], required: true },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true },
  performedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const RegisterSessionSchema = new Schema<IRegisterSession>(
  {
    tenantId: { type: String, required: false, index: true },
    registerId: { type: String, required: true, index: true },
    registerName: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    cashierId: { type: String, required: true, index: true },
    cashierName: { type: String, required: true },
    openingFloat: { type: Number, required: true, min: 0 },
    closingCash: { type: Number },
    expectedCash: { type: Number, default: 0 },
    totalCashSales: { type: Number, default: 0 },
    totalCardSales: { type: Number, default: 0 },
    totalTransferSales: { type: Number, default: 0 },
    totalRefunds: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', index: true },
    cashMovements: [CashMovementSchema],
    openedAt: { type: Date, default: Date.now, required: true },
    closedAt: { type: Date },
    managerNotes: { type: String },
  },
  { timestamps: true }
);

export const RegisterSession = mongoose.model<IRegisterSession>(
  'RegisterSession',
  RegisterSessionSchema
);
