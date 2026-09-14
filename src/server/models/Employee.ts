import mongoose, { Schema, type Document } from 'mongoose';

export interface IEmployee extends Document {
  userId: mongoose.Types.ObjectId;
  employeeId: string;
  departmentId?: mongoose.Types.ObjectId;
  assignedBranchId?: mongoose.Types.ObjectId;
  assignedWarehouseId?: mongoose.Types.ObjectId;
  status: 'ACTIVE' | 'TERMINATED' | 'ON_LEAVE';
  hireDate: Date;
  contactPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    assignedBranchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    assignedWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    status: { type: String, enum: ['ACTIVE', 'TERMINATED', 'ON_LEAVE'], default: 'ACTIVE' },
    hireDate: { type: Date, default: Date.now },
    contactPhone: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);
