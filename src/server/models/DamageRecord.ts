import mongoose, { Schema, type Document } from 'mongoose';

export type DamageActionDecision =
  'REPAIR' | 'RETURN_TO_SUPPLIER' | 'WRITE_OFF' | 'RESTORE_TO_STOCK';

export interface IDamageRecord extends Document {
  damageNumber: string;
  companyId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  lotNumber?: string;
  serialNumber?: string;
  quantity: number;
  costPrice: number;
  totalLossValue: number;
  damageReason:
    'HANDLING_ACCIDENT' | 'WATER_DAMAGE' | 'EXPIRED' | 'CRUSHED' | 'MANUFACTURING_DEFECT' | 'OTHER';
  status: 'REPORTED' | 'INSPECTED' | 'DECISION_PENDING' | 'APPROVED' | 'RESOLVED';
  decision?: DamageActionDecision;
  decisionBy?: mongoose.Types.ObjectId;
  decisionAt?: Date;
  journalEntryId?: mongoose.Types.ObjectId; // Financial write-off post
  notes?: string;
  reportedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DamageRecordSchema = new Schema<IDamageRecord>(
  {
    damageNumber: { type: String, required: true, unique: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation', required: true },
    lotNumber: { type: String },
    serialNumber: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
    totalLossValue: { type: Number, required: true, min: 0 },
    damageReason: {
      type: String,
      enum: [
        'HANDLING_ACCIDENT',
        'WATER_DAMAGE',
        'EXPIRED',
        'CRUSHED',
        'MANUFACTURING_DEFECT',
        'OTHER',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['REPORTED', 'INSPECTED', 'DECISION_PENDING', 'APPROVED', 'RESOLVED'],
      default: 'REPORTED',
      index: true,
    },
    decision: {
      type: String,
      enum: ['REPAIR', 'RETURN_TO_SUPPLIER', 'WRITE_OFF', 'RESTORE_TO_STOCK'],
    },
    decisionBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decisionAt: { type: Date },
    journalEntryId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    notes: { type: String },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const DamageRecord = mongoose.model<IDamageRecord>('DamageRecord', DamageRecordSchema);
