import mongoose from 'mongoose';
import { SupplierInvoice, type ISupplierInvoice } from '../models/SupplierInvoice.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { ProcurementMatch, type IProcurementMatch } from '../models/ProcurementMatch.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface MatchInvoiceInput {
  tenantId?: string;
  companyId?: string;
  invoiceNumber: string;
  supplierId: string;
  poId: string;
  grnId?: string;
  amount: number;
  subtotal?: number;
  taxAmount?: number;
  shippingAmount?: number;
  currency?: string;
  invoiceDate?: Date;
  dueDate?: Date;
  paymentTerms?: string;
  notes?: string;
}

export class ThreeWayMatchAdvancedService {
  public static async processThreeWayMatch(input: MatchInvoiceInput): Promise<{
    invoice: ISupplierInvoice;
    matchRecord: IProcurementMatch;
  }> {
    const tenantId = input.tenantId || 'default';
    const companyId = parseObjectId(input.companyId);

    // Duplicate Invoice Detection Check (Supplier + Invoice Number + Tenant)
    const existingInvoice = await SupplierInvoice.findOne({
      tenantId,
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber,
    });
    if (existingInvoice) {
      throw new ValidationError(
        `Duplicate Invoice Error: Invoice ${input.invoiceNumber} from this supplier already exists in tenant context.`
      );
    }

    const po = await PurchaseOrder.findById(input.poId);
    if (!po) throw new NotFoundError('Purchase Order not found for matching');

    let grn = input.grnId ? await GoodsReceipt.findById(input.grnId) : null;
    if (!grn) {
      grn = await GoodsReceipt.findOne({ poId: po._id }).sort({ createdAt: -1 });
    }

    let matchingStatus: any = 'MATCHED';
    let overallStatus: any = 'MATCHED';
    let priceVariance = 0;
    let quantityVariance = 0;

    // Price Variance Calculation (PO total vs Invoice total)
    if (Math.abs(po.totalAmount - input.amount) > 0.01) {
      priceVariance = input.amount - po.totalAmount;
      const priceVariancePercent = Math.abs((priceVariance / po.totalAmount) * 100);
      if (priceVariancePercent > 1) {
        // Tolerable price threshold > 1%
        matchingStatus = 'EXCEPTION_PRICE_MISMATCH';
        overallStatus = 'PRICE_VARIANCE';
      }
    }

    // Quantity Variance Calculation across all Goods Receipts for this PO
    const allGRNs = await GoodsReceipt.find({ poId: po._id });
    if (allGRNs.length === 0) {
      matchingStatus = 'EXCEPTION_MISSING_RECEIPT';
      overallStatus = 'MISSING_RECEIPT';
    } else {
      let poTotalQty = 0;
      let grnTotalQty = 0;
      for (const pItem of po.items) poTotalQty += pItem.quantity;
      for (const gRecord of allGRNs) {
        for (const gItem of gRecord.items) grnTotalQty += gItem.quantityReceived;
      }

      if (poTotalQty !== grnTotalQty) {
        quantityVariance = poTotalQty - grnTotalQty;
        if (matchingStatus === 'MATCHED') {
          matchingStatus = 'EXCEPTION_QTY_MISMATCH';
          overallStatus = 'QUANTITY_VARIANCE';
        }
      }
    }

    const dueDate = input.dueDate || new Date(Date.now() + 30 * 86400000);

    const invoice = await SupplierInvoice.create({
      tenantId,
      companyId,
      invoiceNumber: input.invoiceNumber,
      poId: po._id,
      poNumber: po.poNumber,
      grnId: grn?._id,
      supplierId: new mongoose.Types.ObjectId(input.supplierId),
      supplierName: po.supplierName,
      subtotal: input.subtotal || po.subtotal,
      taxAmount: input.taxAmount || po.taxAmount,
      shippingAmount: input.shippingAmount || po.shippingCost,
      amount: input.amount,
      currency: input.currency || po.currency || 'USD',
      invoiceDate: input.invoiceDate || new Date(),
      dueDate,
      status: 'UNPAID',
      matchingStatus,
      paymentTerms: input.paymentTerms || po.paymentTerms || 'NET 30',
      notes: input.notes,
    });

    const matchRecord = await ProcurementMatch.create({
      tenantId,
      companyId,
      invoiceId: invoice._id,
      poId: po._id,
      grnId: grn?._id,
      priceVariance,
      quantityVariance,
      taxVariance: (input.taxAmount || 0) - po.taxAmount,
      overallStatus,
      isApprovedForPayment: overallStatus === 'MATCHED',
    });

    if (overallStatus === 'MATCHED') {
      po.status = 'BILLED';
      await po.save();
      eventBus.emit('procurement.invoice.matched', {
        invoiceId: invoice._id,
        poNumber: po.poNumber,
      });
    } else {
      eventBus.emit('procurement.invoice.exception', {
        invoiceId: invoice._id,
        status: overallStatus,
      });
    }

    return { invoice, matchRecord };
  }

  public static async approveMatchException(
    matchId: string,
    approvedBy: string,
    approvedByName?: string,
    notes?: string
  ): Promise<IProcurementMatch> {
    const match = await ProcurementMatch.findById(matchId);
    if (!match) throw new NotFoundError('Procurement match record not found');

    match.isApprovedForPayment = true;
    match.approvedBy = parseObjectId(approvedBy);
    match.approvedByName = approvedByName || 'Finance Manager';
    if (notes) match.notes = notes;
    await match.save();

    await SupplierInvoice.findByIdAndUpdate(match.invoiceId, {
      matchingStatus: 'APPROVED_EXCEPTION',
    });

    await PurchaseOrder.findByIdAndUpdate(match.poId, {
      status: 'BILLED',
    });

    eventBus.emit('procurement.invoice.matched', { invoiceId: match.invoiceId });

    return match;
  }
}
