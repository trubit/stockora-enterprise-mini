import mongoose, { Schema, type Document } from 'mongoose';

export interface IPurchaseRequisitionItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  estimatedCost: number;
  reason?: string;
}

export type RequisitionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CONVERTED';

export type RequisitionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface IPurchaseRequisition extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  requisitionNumber: string;
  requestedBy: mongoose.Types.ObjectId;
  requesterName?: string;
  items: IPurchaseRequisitionItem[];
  priority: RequisitionPriority;
  status: RequisitionStatus;
  requiredDate?: Date;
  estimatedTotalCost: number;
  supplierRecommendationId?: mongoose.Types.ObjectId;
  convertedPoId?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedByName?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseRequisitionItemSchema = new Schema<IPurchaseRequisitionItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  estimatedCost: { type: Number, required: true, default: 0, min: 0 },
  reason: { type: String },
});

const PurchaseRequisitionSchema = new Schema<IPurchaseRequisition>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    requisitionNumber: { type: String, required: true, unique: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requesterName: { type: String },
    items: [PurchaseRequisitionItemSchema],
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'CONVERTED',
      ],
      default: 'SUBMITTED',
      required: true,
      index: true,
    },
    requiredDate: { type: Date },
    estimatedTotalCost: { type: Number, default: 0, min: 0 },
    supplierRecommendationId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    convertedPoId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String },
    rejectionReason: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

export const PurchaseRequisition =
  mongoose.models.PurchaseRequisition ||
  mongoose.model<IPurchaseRequisition>('PurchaseRequisition', PurchaseRequisitionSchema);
