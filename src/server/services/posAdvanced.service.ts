import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { POSTerminal } from '../models/POSTerminal.js';
import { RegisterSession } from '../models/RegisterSession.js';
import { HeldSale } from '../models/HeldSale.js';
import { SalesTransaction } from '../models/SalesTransaction.js';
import { Transaction } from '../models/Transaction.js';
import { StockMovement } from '../models/StockMovement.js';
import { InventoryReservation } from '../models/InventoryReservation.js';
import { Tenant } from '../models/Tenant.js';
import { Company } from '../models/Company.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface BarcodeScanResult {
  product: any;
  availableStock: number;
  isAvailable: boolean;
}

export class POSAdvancedService {
  public static async scanBarcodeOrSku(
    barcodeOrSku: string,
    tenantId?: string
  ): Promise<BarcodeScanResult> {
    const filter: any = {
      $or: [
        { sku: barcodeOrSku.trim() },
        { barcode: barcodeOrSku.trim() },
        { name: { $regex: barcodeOrSku.trim(), $options: 'i' } },
      ],
    };
    if (tenantId && tenantId !== 'default') {
      filter.$or.push({ tenantId });
    }
    const product: any = await Product.findOne({
      $or: [
        { sku: barcodeOrSku.trim() },
        { barcode: barcodeOrSku.trim() },
        { name: { $regex: barcodeOrSku.trim(), $options: 'i' } },
      ],
    }).lean();

    if (!product) throw new NotFoundError(`Product not found for scan query "${barcodeOrSku}"`);

    const availableStock = product.quantity || 0;
    return {
      product,
      availableStock,
      isAvailable: availableStock > 0,
    };
  }

  public static async holdSale(input: {
    tenantId?: string;
    branchId: string;
    cashierId: string;
    cashierName: string;
    customerId?: string;
    customerName?: string;
    cartItems: any[];
    notes?: string;
  }): Promise<any> {
    const holdId = `HOLD-${Date.now().toString().slice(-6)}`;
    const subtotal = input.cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const held = await HeldSale.create({
      tenantId: input.tenantId || 'default',
      holdId,
      branchId: new mongoose.Types.ObjectId(input.branchId),
      cashierId: input.cashierId,
      cashierName: input.cashierName,
      customerId: parseObjectId(input.customerId),
      customerName: input.customerName,
      cartItems: input.cartItems,
      subtotal,
      notes: input.notes,
    });

    eventBus.emit('pos.sale.held', { holdId, cashierId: input.cashierId });
    return held;
  }

  public static async resumeSale(holdId: string): Promise<any> {
    const held = await HeldSale.findOne({ holdId });
    if (!held) throw new NotFoundError('Held sale transaction not found');

    await HeldSale.deleteOne({ _id: held._id });
    eventBus.emit('pos.sale.resumed', { holdId });
    return held;
  }

  public static async generateThermalReceipt(transactionId: string): Promise<any> {
    const tx: any =
      (await SalesTransaction.findById(transactionId).populate(
        'terminalId cashierId customerId'
      )) || (await Transaction.findById(transactionId));
    if (!tx) throw new NotFoundError('Sales transaction not found for receipt');

    const tenant: any = tx.tenantId
      ? (await Tenant.findById(tx.tenantId).lean()) ||
        (await Tenant.findOne({ slug: tx.tenantId }).lean())
      : null;
    const company: any = tx.tenantId
      ? await Company.findOne({ tenantId: tx.tenantId }).lean()
      : tx.companyId
        ? await Company.findById(tx.companyId).lean()
        : null;

    const businessName = tenant?.name || company?.name || tx.companyName || 'Retail Store';
    const legalName = tenant?.legalName || company?.legalName;
    const logoUrl = tenant?.branding?.logoUrl || company?.logoUrl;
    const address = (() => {
      const raw = tenant?.contact
        ? [
            tenant.contact.addressLine1,
            tenant.contact.city,
            tenant.contact.state,
            tenant.contact.country &&
            tenant.contact.country.trim().toUpperCase() !== 'US' &&
            tenant.contact.country.trim().toUpperCase() !== 'USA'
              ? tenant.contact.country.trim()
              : undefined,
          ]
            .filter(Boolean)
            .join(', ')
        : company?.address || '';
      if (!raw) return '';
      const upper = raw.trim().toUpperCase().replace(/[\.,]/g, '');
      if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES') return '';
      const cleaned = raw
        .trim()
        .replace(/,\s*(US|USA|United States)$/i, '')
        .trim();
      return cleaned.toUpperCase() === 'US' || cleaned.toUpperCase() === 'USA' ? '' : cleaned;
    })();
    const phone = tenant?.contact?.phone || company?.phone || '';
    const email = tenant?.contact?.email || company?.email || '';
    const taxId = tenant?.taxConfig?.taxId || company?.taxId || '';
    const headerNotice = tenant?.branding?.receiptHeader || '';
    const footerNotice =
      tenant?.branding?.receiptFooter ||
      'Thank you for shopping with us! Retain receipt for returns.';

    return {
      header: {
        businessName,
        legalName,
        logoUrl,
        address,
        phone,
        email,
        taxId,
        headerNotice,
      },
      transactionNumber: tx.transactionNumber,
      date: tx.createdAt,
      cashier: tx.cashierName || 'Cashier Operator',
      customer: tx.customerName || 'Walk-in Guest',
      items: (tx.items || []).map((i: any) => ({
        name: i.name || i.productName,
        qty: i.quantity,
        price: i.unitPrice ?? i.price,
        total: i.lineTotal ?? i.total,
      })),
      totals: {
        subtotal: tx.subtotal,
        discountTotal: tx.discountTotal ?? tx.discount ?? 0,
        taxTotal: tx.taxTotal ?? tx.tax ?? 0,
        totalAmount: tx.totalAmount ?? tx.total ?? tx.amount ?? 0,
      },
      payments: tx.payments,
      footerNote: footerNotice,
      platformAttribution: 'Powered by Stockora Enterprise',
    };
  }

  public static async syncOfflineQueue(
    transactions: any[],
    tenantId = 'default'
  ): Promise<{ synced: number; skipped: number; errors: any[] }> {
    let synced = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const txData of transactions) {
      try {
        const idempotencyKey =
          txData.idempotencyKey || `${txData.terminalId}-${txData.transactionNumber}`;
        const existing = await SalesTransaction.findOne({ idempotencyKey });
        if (existing) {
          skipped++;
          continue;
        }

        const transactionNumber =
          txData.transactionNumber || `POS-OFFLINE-${Date.now().toString().slice(-6)}`;

        const tx = await SalesTransaction.create({
          ...txData,
          tenantId,
          transactionNumber,
          idempotencyKey,
          isOfflineSync: true,
          status: 'COMPLETED',
        });

        // Reserve & deduct inventory
        for (const item of tx.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -item.quantity },
          });

          await StockMovement.create({
            tenantId,
            productId: item.productId,
            quantity: -item.quantity,
            type: 'SALE',
            referenceId: transactionNumber,
            notes: `Offline POS sale sync (${transactionNumber})`,
          });
        }

        synced++;
        eventBus.emit('pos.offline.synced', { transactionId: tx._id, transactionNumber });
      } catch (err: any) {
        errors.push({ transactionNumber: txData.transactionNumber, error: err.message });
      }
    }

    return { synced, skipped, errors };
  }
}
