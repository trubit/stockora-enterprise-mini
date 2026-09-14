import mongoose, { Schema, type Document } from 'mongoose';

export interface IPurchaseOrderRevision extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  purchaseOrderId: mongoose.Types.ObjectId;
  poNumber: string;
  revisionNumber: number;
  changedBy?: mongoose.Types.ObjectId;
  changedByName?: string;
  changesDescription: string;
  snapshot: any;
  createdAt: Date;
}

const PurchaseOrderRevisionSchema = new Schema<IPurchaseOrderRevision>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
      index: true,
    },
    poNumber: { type: String, required: true },
    revisionNumber: { type: Number, required: true, min: 1 },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String },
    changesDescription: { type: String, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PurchaseOrderRevision =
  mongoose.models.PurchaseOrderRevision ||
  mongoose.model<IPurchaseOrderRevision>('PurchaseOrderRevision', PurchaseOrderRevisionSchema);
