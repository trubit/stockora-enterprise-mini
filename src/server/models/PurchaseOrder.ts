import mongoose, { Schema, type Document } from 'mongoose';

export interface IPurchaseOrderItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  supplierSku?: string;
  quantity: number;
  costPrice: number;
  receivedQuantity: number;
  rejectedQuantity?: number;
  outstandingQuantity?: number;
  taxRate?: number;
  discount?: number;
  lineTotal?: number;
}

export interface IPORevision {
  version: number;
  revisedBy?: mongoose.Types.ObjectId;
  revisedByName?: string;
  revisedAt: Date;
  reason?: string;
  previousTotalAmount: number;
  newTotalAmount: number;
  changesDescription?: string;
}

export interface ISupplierCounterProposal {
  proposedDeliveryDate?: Date;
  proposedItems?: { productId: mongoose.Types.ObjectId; proposedQuantity: number }[];
  comments?: string;
  status: 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';
  proposedAt: Date;
}

export type POStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'COUNTER_PROPOSED'
  | 'SUPPLIER_CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'PARTIALLY_BILLED'
  | 'BILLED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface IPurchaseOrder extends Document {
  tenantId?: string;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  poNumber: string;
  supplierRef?: string;
  requisitionId?: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  supplierName?: string;
  items: IPurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  paymentTerms?: string;
  status: POStatus;
  version: number;
  revisions?: IPORevision[];
  acknowledgementStatus?:
    'UNSENT' | 'SENT' | 'VIEWED' | 'ACKNOWLEDGED' | 'REJECTED' | 'COUNTER_PROPOSED';
  acknowledgementDate?: Date;
  counterProposal?: ISupplierCounterProposal;
  termsAndConditions?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedByName?: string;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String },
  supplierSku: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  costPrice: { type: Number, required: true, min: 0 },
  receivedQuantity: { type: Number, required: true, default: 0, min: 0 },
  rejectedQuantity: { type: Number, default: 0, min: 0 },
  outstandingQuantity: { type: Number, default: 0, min: 0 },
  taxRate: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  lineTotal: { type: Number, default: 0, min: 0 },
});

const PORevisionSchema = new Schema<IPORevision>({
  version: { type: Number, required: true },
  revisedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  revisedByName: { type: String },
  revisedAt: { type: Date, default: Date.now },
  reason: { type: String },
  previousTotalAmount: { type: Number, default: 0 },
  newTotalAmount: { type: Number, default: 0 },
  changesDescription: { type: String },
});

const SupplierCounterProposalSchema = new Schema<ISupplierCounterProposal>({
  proposedDeliveryDate: { type: Date },
  proposedItems: [
    {
      productId: { type: Schema.Types.ObjectId, ref: 'Product' },
      proposedQuantity: { type: Number },
    },
  ],
  comments: { type: String },
  status: {
    type: String,
    enum: ['PENDING_REVIEW', 'ACCEPTED', 'REJECTED'],
    default: 'PENDING_REVIEW',
  },
  proposedAt: { type: Date, default: Date.now },
});

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    tenantId: { type: String, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', index: true },
    poNumber: { type: String, required: true, unique: true, index: true },
    supplierRef: { type: String, trim: true },
    requisitionId: { type: Schema.Types.ObjectId, ref: 'PurchaseRequisition' },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    supplierName: { type: String },
    items: [PurchaseOrderItemSchema],
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true, trim: true },
    expectedDeliveryDate: { type: Date, index: true },
    actualDeliveryDate: { type: Date },
    paymentTerms: { type: String, default: 'NET 30' },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'SENT',
        'ACKNOWLEDGED',
        'COUNTER_PROPOSED',
        'SUPPLIER_CONFIRMED',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'PARTIALLY_BILLED',
        'BILLED',
        'CLOSED',
        'REJECTED',
        'CANCELLED',
        'EXPIRED',
      ],
      default: 'PENDING_APPROVAL',
      required: true,
      index: true,
    },
    version: { type: Number, default: 1, min: 1 },
    revisions: [PORevisionSchema],
    acknowledgementStatus: {
      type: String,
      enum: ['UNSENT', 'SENT', 'VIEWED', 'ACKNOWLEDGED', 'REJECTED', 'COUNTER_PROPOSED'],
      default: 'UNSENT',
    },
    acknowledgementDate: { type: Date },
    counterProposal: SupplierCounterProposalSchema,
    termsAndConditions: { type: String },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String },
    approvedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const PurchaseOrder =
  mongoose.models.PurchaseOrder ||
  mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
