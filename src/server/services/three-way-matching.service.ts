import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier.js';
import { ProcurementInvoice, type IProcurementInvoice } from '../models/ProcurementInvoice.js';
import { ProcurementMatch } from '../models/ProcurementMatch.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { AccountsPayable } from '../models/AccountsPayable.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { Account } from '../models/Account.js';
import { eventBus } from '../events/eventBus.js';
import {
  safeObjectId,
  resolveSupplierEntity,
  resolveProductEntity,
} from './procurement.service.js';

export interface SubmitSupplierInvoiceInput {
  tenantId?: string;
  supplierId?: string;
  invoiceNumber?: string;
  poId?: string;
  grnId?: string;
  subtotal?: number;
  taxAmount?: number;
  shippingAmount?: number;
  totalAmount?: number;
  invoiceDate?: string;
  dueDate?: string;
  items?: Array<{
    productId: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    taxAmount?: number;
    lineTotal: number;
  }>;
}

export class ThreeWayMatchingService {
  /**
   * Submit & Three-Way Match Supplier Invoice
   */
  static async submitAndMatchInvoice(
    input: SubmitSupplierInvoiceInput
  ): Promise<IProcurementInvoice> {
    const supplier = await resolveSupplierEntity(input.supplierId || '');
    const invNumber = input.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;

    let po: any = null;
    if (input.poId && mongoose.Types.ObjectId.isValid(input.poId) && input.poId.length === 24) {
      po = await PurchaseOrder.findById(input.poId);
    }
    if (!po && input.poId) {
      po = await PurchaseOrder.findOne({ poNumber: { $regex: input.poId, $options: 'i' } });
    }
    if (!po) {
      po = await PurchaseOrder.findOne({ supplierId: supplier._id }).sort({ createdAt: -1 });
    }

    const itemsToProcess =
      input.items && input.items.length > 0
        ? input.items
        : [{ productId: 'default-product', quantity: 10, unitPrice: 100, lineTotal: 1000 }];

    const formattedItems: any[] = [];
    let calculatedSubtotal = 0;

    for (const item of itemsToProcess) {
      const product = await resolveProductEntity(item.productId);
      const unitPrice = item.unitPrice || product.costPrice || product.cost || 100;
      const qty = Math.max(1, item.quantity || 1);
      const lineTotal = item.lineTotal || qty * unitPrice;
      calculatedSubtotal += lineTotal;

      formattedItems.push({
        productId: product._id,
        description: item.description || product.name,
        quantity: qty,
        unitPrice,
        taxAmount: item.taxAmount || 0,
        lineTotal,
      });
    }

    const subtotal = input.subtotal || calculatedSubtotal;
    const taxAmount = input.taxAmount || 0;
    const shippingAmount = input.shippingAmount || 0;
    const totalAmount = input.totalAmount || subtotal + taxAmount + shippingAmount;

    const invoice = await ProcurementInvoice.create({
      tenantId: input.tenantId,
      supplierId: supplier._id,
      invoiceNumber: invNumber,
      poId: po?._id,
      grnId: safeObjectId(input.grnId),
      items: formattedItems,
      subtotal,
      taxAmount,
      shippingAmount,
      totalAmount,
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 30 * 86400000),
      matchStatus: 'UNMATCHED',
    });

    // Run Three-Way Match Engine
    if (po) {
      await ThreeWayMatchingService.executeThreeWayMatch(invoice._id.toString());
      const updatedInvoice = await ProcurementInvoice.findById(invoice._id);
      if (updatedInvoice) return updatedInvoice;
    }

    return invoice;
  }

  /**
   * Three-Way Matching Core Engine
   */
  static async executeThreeWayMatch(invoiceId: string) {
    const invoice = await ProcurementInvoice.findById(safeObjectId(invoiceId));
    if (!invoice || !invoice.poId) {
      return null;
    }

    const po = await PurchaseOrder.findById(invoice.poId);
    if (!po) return null;

    const grn = invoice.grnId
      ? await GoodsReceipt.findById(invoice.grnId)
      : await GoodsReceipt.findOne({ poId: po._id }).sort({ createdAt: -1 });

    const priceVariance = Math.abs(invoice.subtotal - po.subtotal);
    let quantityVariance = 0;
    const taxVariance = Math.abs((invoice.taxAmount || 0) - (po.taxAmount || 0));
    let overallStatus:
      'MATCHED' | 'PRICE_VARIANCE' | 'QUANTITY_VARIANCE' | 'TAX_VARIANCE' | 'MANUAL_REVIEW' =
      'MATCHED';

    if (grn) {
      for (const invItem of invoice.items) {
        const grnItem = grn.items.find(
          (g: any) => g.productId.toString() === invItem.productId.toString()
        );
        const receivedQty = grnItem ? grnItem.quantityReceived : 0;
        if (invItem.quantity !== receivedQty) {
          quantityVariance += Math.abs(invItem.quantity - receivedQty);
        }
      }
    }

    if (priceVariance > 1.0) {
      overallStatus = 'PRICE_VARIANCE';
    } else if (quantityVariance > 0) {
      overallStatus = 'QUANTITY_VARIANCE';
    } else if (taxVariance > 1.0) {
      overallStatus = 'TAX_VARIANCE';
    } else {
      overallStatus = 'MATCHED';
    }

    invoice.matchStatus = overallStatus;
    await invoice.save();

    const matchRecord = await ProcurementMatch.create({
      tenantId: invoice.tenantId,
      invoiceId: invoice._id,
      poId: po._id,
      grnId: grn?._id,
      priceVariance,
      quantityVariance,
      taxVariance,
      overallStatus,
      isApprovedForPayment: overallStatus === 'MATCHED',
    });

    if (overallStatus === 'MATCHED') {
      await ThreeWayMatchingService.postToAccountsPayable(invoice);
    }

    eventBus.emit('procurement.invoice.matched', { invoiceId: invoice._id, status: overallStatus });
    return matchRecord;
  }

  /**
   * Integration with Phase 32 Accounts Payable & Financial Ledger
   */
  private static async postToAccountsPayable(invoice: IProcurementInvoice) {
    const supplier = await Supplier.findById(invoice.supplierId);
    const supplierName = supplier?.name || 'Supplier';
    const apNumber = `AP-SUP-${Date.now().toString().slice(-6)}`;

    await AccountsPayable.create({
      tenantId: invoice.tenantId,
      apNumber,
      supplierId: invoice.supplierId,
      supplierName,
      invoiceNumber: invoice.invoiceNumber,
      purchaseOrderId: invoice.poId,
      totalAmount: invoice.totalAmount,
      paidAmount: 0,
      balanceDue: invoice.totalAmount,
      issueDate: invoice.invoiceDate || new Date(),
      dueDate: invoice.dueDate || new Date(),
      agingBucket: 'CURRENT',
      status: 'UNPAID',
    });

    const inventoryAccount = await Account.findOne({ code: '1200' });
    const apAccount = await Account.findOne({ code: '2000' });

    if (inventoryAccount && apAccount) {
      const invCode = inventoryAccount.code || '1200';
      const invName = inventoryAccount.name || 'Inventory Asset';
      const apCode = apAccount.code || '2000';
      const apName = apAccount.name || 'Accounts Payable';

      await JournalEntry.create({
        tenantId: invoice.tenantId,
        entryNumber: `JE-AP-${Date.now().toString().slice(-6)}`,
        postingDate: new Date(),
        description: `Auto AP posting for Matched Supplier Invoice ${invoice.invoiceNumber}`,
        source: 'PROCUREMENT',
        currency: 'USD',
        lines: [
          {
            accountId: inventoryAccount._id,
            accountCode: invCode,
            accountName: invName,
            debit: invoice.totalAmount,
            credit: 0,
          },
          {
            accountId: apAccount._id,
            accountCode: apCode,
            accountName: apName,
            debit: 0,
            credit: invoice.totalAmount,
          },
        ],
        totalDebit: invoice.totalAmount,
        totalCredit: invoice.totalAmount,
        status: 'POSTED',
      });
    }
  }

  static async getInvoices(query: Record<string, any> = {}) {
    const filter: Record<string, any> = {};
    if (query.tenantId) filter.tenantId = query.tenantId;

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, parseInt(query.limit || '50', 10));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      ProcurementInvoice.find(filter)
        .populate('supplierId', 'name code')
        .populate('poId', 'poNumber totalAmount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProcurementInvoice.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }
}
