import mongoose from 'mongoose';
import {
  OmnichannelOrder,
  type IOmnichannelOrder,
  type IPaymentAllocation,
} from '../models/OmnichannelOrder.js';
import { HeldSale, type IHeldSale } from '../models/HeldSale.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { Receipt } from '../models/Receipt.js';
import { CRMService } from './crm.service.js';
import { LoyaltyService } from './loyalty.service.js';
import { ReservationService } from './reservation.service.js';
import { Tenant } from '../models/Tenant.js';
import { Company } from '../models/Company.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { redis } from '../database/redis.js';
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';

export type PosManualPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD';

function formatCleanAddress(contact?: any, fallback?: string): string {
  const raw = contact
    ? [
        contact.addressLine1,
        contact.addressLine2,
        contact.city,
        contact.state,
        contact.country &&
        contact.country.trim().toUpperCase() !== 'US' &&
        contact.country.trim().toUpperCase() !== 'USA'
          ? contact.country.trim()
          : undefined,
      ]
        .filter(Boolean)
        .join(', ')
    : fallback || '';
  if (!raw) return '';
  const upper = raw.trim().toUpperCase().replace(/[\.,]/g, '');
  if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES') return '';
  const cleaned = raw
    .trim()
    .replace(/,\s*(US|USA|United States)$/i, '')
    .trim();
  return cleaned.toUpperCase() === 'US' || cleaned.toUpperCase() === 'USA' ? '' : cleaned;
}

export interface POSCartItemInput {
  productId: string;
  quantity: number;
  priceTier?: 'RETAIL' | 'WHOLESALE';
  unitPrice?: number;
  discount?: number;
}

export interface POSCheckoutInput {
  idempotencyKey?: string;
  tenantId?: string;
  branchId?: string;
  warehouseId?: string;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  items: POSCartItemInput[];
  pricingMode?: 'RETAIL' | 'WHOLESALE' | 'MIXED';
  paymentMethod?: PosManualPaymentMethod | string;
  amountTendered?: number;
  referenceNumber?: string;
  payments?: {
    paymentMethod: string;
    amount: number;
    referenceNumber?: string;
  }[];
  cartDiscount?: number;
  taxRate?: number; // e.g. 0.07 for 7%
  subtotal?: number;
  taxTotal?: number;
  discountTotal?: number;
  grandTotal?: number;
  total?: number;
  currency?: string;
  channel?: string;
  notes?: string;
}

export class POSService {
  /**
   * Calculate POS cart subtotal, tax, discounts, and total
   */
  public static calculateCart(
    items: { unitPrice: number; quantity: number; discount?: number }[],
    _taxRate = 0,
    cartDiscount = 0
  ) {
    let subtotal = 0;
    let itemDiscounts = 0;

    for (const item of items) {
      const lineSub = item.unitPrice * item.quantity;
      const lineDisc = (item.discount || 0) * item.quantity;
      subtotal += lineSub;
      itemDiscounts += lineDisc;
    }

    const totalDiscount = itemDiscounts + cartDiscount;
    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const taxTotal = 0;
    const grandTotal = Number(taxableAmount.toFixed(2));

    return {
      subtotal,
      discountTotal: totalDiscount,
      taxTotal,
      grandTotal,
    };
  }

  /**
   * Process POS Checkout with single manual tender, cashier confirmation, and inventory consistency
   */
  public static async checkout(input: POSCheckoutInput): Promise<IOmnichannelOrder> {
    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existing = await OmnichannelOrder.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) {
        logger.info(`[POS Service] Idempotency match found for key: ${input.idempotencyKey}`);
        return existing;
      }
    }

    // 2. Enforce Strict Manual POS Payment Boundary
    // Reject split payment attempts
    if (input.payments && input.payments.length > 1) {
      throw new Error(
        'Split payment is forbidden in POS. Each POS transaction must use a single payment method.'
      );
    }

    let resolvedMethod = (input.paymentMethod || input.payments?.[0]?.paymentMethod || 'CASH')
      .toString()
      .toUpperCase()
      .trim();

    // Map common aliases
    if (
      resolvedMethod === 'TRANSFER' ||
      resolvedMethod === 'BANK' ||
      resolvedMethod === 'MOBILE_TRANSFER'
    ) {
      resolvedMethod = 'BANK_TRANSFER';
    } else if (
      resolvedMethod === 'DEBIT' ||
      resolvedMethod === 'CREDIT' ||
      resolvedMethod === 'POS_CARD'
    ) {
      resolvedMethod = 'CARD';
    }

    // Strict rejection of forbidden online gateways and split keywords
    if (
      resolvedMethod === 'PAYSTACK' ||
      resolvedMethod === 'STRIPE' ||
      resolvedMethod === 'ONLINE' ||
      resolvedMethod === 'GATEWAY' ||
      resolvedMethod.includes('SPLIT')
    ) {
      throw new Error(
        `Payment method [${resolvedMethod}] is not permitted for in-person POS sales. POS only accepts CASH, BANK_TRANSFER, and CARD.`
      );
    }

    if (!['CASH', 'BANK_TRANSFER', 'CARD'].includes(resolvedMethod)) {
      throw new Error(
        `Invalid POS payment method: [${resolvedMethod}]. Allowed methods are CASH, BANK_TRANSFER, and CARD.`
      );
    }

    // 3. Validate Cart Items & Build Details
    if (!input.items || input.items.length === 0) {
      throw new Error('POS Cart cannot be empty.');
    }

    const itemDetails = [];
    for (const itemInput of input.items) {
      const product = await Product.findById(itemInput.productId);
      if (!product) {
        throw new Error(`Product ID ${itemInput.productId} not found.`);
      }
      if (product.quantity < itemInput.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name} (SKU: ${product.sku}). On hand: ${product.quantity}`
        );
      }

      const priceTier: 'RETAIL' | 'WHOLESALE' =
        itemInput.priceTier === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
      const expectedPrice =
        priceTier === 'WHOLESALE'
          ? product.wholesalePrice && product.wholesalePrice > 0
            ? product.wholesalePrice
            : product.retailPrice && product.retailPrice > 0
              ? product.retailPrice
              : product.sellingPrice || 0
          : product.retailPrice && product.retailPrice > 0
            ? product.retailPrice
            : product.sellingPrice || 0;

      const unitPrice =
        itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : expectedPrice;
      const discount = itemInput.discount ?? 0;
      const lineTotal = Math.max(0, (unitPrice - discount) * itemInput.quantity);

      itemDetails.push({
        productId: new mongoose.Types.ObjectId(product._id.toString()),
        sku: product.sku,
        name: product.name,
        quantity: itemInput.quantity,
        priceTier,
        unitPrice,
        discount,
        tax: 0,
        total: lineTotal,
      });
    }

    // 4. Server-Side Totals Calculation
    const calc = this.calculateCart(itemDetails, 0, input.cartDiscount || 0);

    // 5. Payment Tender & Change Validation
    const amountTendered =
      input.amountTendered !== undefined
        ? Number(input.amountTendered)
        : input.payments?.[0]?.amount || calc.grandTotal;

    if (resolvedMethod === 'CASH') {
      if (amountTendered < calc.grandTotal) {
        throw new Error(
          `Insufficient cash received: Insufficient payment amount. Total due: $${calc.grandTotal}, received: $${amountTendered.toFixed(2)}`
        );
      }
    } else {
      // For Bank Transfer and Physical Card, cashier confirms full amount received
      if (amountTendered < calc.grandTotal) {
        throw new Error(
          `Insufficient payment amount: confirmed amount is less than total. Total due: $${calc.grandTotal}, confirmed: $${amountTendered.toFixed(2)}`
        );
      }
    }

    const changeAmount =
      resolvedMethod === 'CASH' ? Number((amountTendered - calc.grandTotal).toFixed(2)) : 0;

    // 6. Generate Order Number
    const orderCount = await OmnichannelOrder.countDocuments();
    const orderNumber = `POS-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${String(orderCount + 1).padStart(4, '0')}`;

    // 7. Formulate Single Payment Allocation Record
    const refNo =
      input.referenceNumber || input.payments?.[0]?.referenceNumber || `POS-REF-${Date.now()}`;
    const paymentAllocations: IPaymentAllocation[] = [
      {
        paymentMethod: resolvedMethod as any,
        amount: calc.grandTotal,
        referenceNumber: refNo,
        status: 'PAID',
        paidAt: new Date(),
      },
    ];

    // 8. Create Omnichannel Order Record
    const resolvedPricingMode: 'RETAIL' | 'WHOLESALE' | 'MIXED' =
      input.pricingMode ||
      (itemDetails.every((i) => i.priceTier === 'WHOLESALE')
        ? 'WHOLESALE'
        : itemDetails.some((i) => i.priceTier === 'WHOLESALE')
          ? 'MIXED'
          : 'RETAIL');

    const order = await OmnichannelOrder.create({
      tenantId: input.tenantId,
      orderNumber,
      channel: 'POS',
      pricingMode: resolvedPricingMode,
      customerId: input.customerId ? new mongoose.Types.ObjectId(input.customerId) : undefined,
      customerName: input.customerName || 'Walk-in Customer',
      customerEmail: input.customerEmail,
      branchId: new mongoose.Types.ObjectId(input.branchId),
      warehouseId: input.warehouseId
        ? new mongoose.Types.ObjectId(input.warehouseId)
        : new mongoose.Types.ObjectId(input.branchId),
      cashierId: input.cashierId,
      cashierName: input.cashierName,
      items: itemDetails,
      subtotal: calc.subtotal,
      taxTotal: calc.taxTotal,
      discountTotal: calc.discountTotal,
      grandTotal: calc.grandTotal,
      paymentStatus: 'PAID',
      payments: paymentAllocations,
      fulfillmentStatus: 'DELIVERED',
      fulfillmentMethod: 'PICKUP',
      status: 'COMPLETED',
      idempotencyKey: input.idempotencyKey,
      notes: input.notes ? `${input.notes} | Change: $${changeAmount}` : `Change: $${changeAmount}`,
    });

    // 8. Deduct stock & create inventory movements
    for (const item of itemDetails) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: -item.quantity },
      });
    }

    if (input.tenantId) {
      try {
        await redis.del(`tenant:${input.tenantId}:products:all`);
        await redis.del(`tenant:${input.tenantId}:products:low_stock`);
      } catch (cacheErr) {
        logger.warn(`Failed to clear product redis cache during POS checkout: ${cacheErr}`);
      }
    }

    // Resolve tenant / company info for legacy transaction
    const tenantInfo: any = input.tenantId
      ? (await Tenant.findById(input.tenantId).lean()) ||
        (await Tenant.findOne({ slug: input.tenantId }).lean())
      : null;
    const companyInfo: any = input.tenantId
      ? await Company.findOne({ tenantId: input.tenantId }).lean()
      : null;
    const resolvedBizName = tenantInfo?.name || companyInfo?.name || 'Retail Store';

    // 9. Record POS Transaction for legacy compatibility
    await Transaction.create({
      tenantId: input.tenantId,
      companyName: resolvedBizName,
      companyLogoUrl: tenantInfo?.branding?.logoUrl || companyInfo?.logoUrl,
      companyAddress: formatCleanAddress(tenantInfo?.contact, companyInfo?.address),
      companyPhone: tenantInfo?.contact?.phone || companyInfo?.phone,
      companyEmail: tenantInfo?.contact?.email || companyInfo?.email,
      companyTaxId: undefined,
      receiptHeader: tenantInfo?.branding?.receiptHeader,
      receiptFooter: tenantInfo?.branding?.receiptFooter,
      transactionNumber: orderNumber,
      type: 'SALE',
      status: 'COMPLETED',
      pricingMode: resolvedPricingMode,
      items: itemDetails.map((i) => ({
        productId: i.productId.toString(),
        productName: i.name,
        sku: i.sku,
        quantity: i.quantity,
        priceTier: i.priceTier,
        price: i.unitPrice,
        discount: i.discount,
        total: i.total,
      })),
      subtotal: calc.subtotal,
      tax: calc.taxTotal,
      discount: calc.discountTotal,
      total: calc.grandTotal,
      paymentMethod: resolvedMethod as 'CASH' | 'CARD' | 'BANK_TRANSFER',
      customerEmail: input.customerEmail,
      cashierId: input.cashierId || new mongoose.Types.ObjectId().toString(),
      cashierName: input.cashierName || 'Cashier',
      branchId: input.branchId || input.warehouseId || new mongoose.Types.ObjectId().toString(),
      branchName: (input as any).branchName || 'Main Store',
    });

    // 10. Update Customer 360 & Loyalty
    if (input.customerId) {
      await ResilientExecutor.execute({ name: `pos-crm-update:${orderNumber}` }, async () => {
        await CRMService.recalculateCustomerMetrics(input.customerId!);
        await CRMService.recordTimelineEvent(
          input.customerId!,
          'PURCHASE',
          `POS Purchase #${orderNumber}`,
          `Total paid: $${calc.grandTotal}`,
          { orderNumber, total: calc.grandTotal }
        );
        await LoyaltyService.earnPoints(input.customerId!, calc.grandTotal, orderNumber);
      });
    }

    // 11. Emit POS event
    eventBus.emit('order.created', { orderNumber, channel: 'POS', total: calc.grandTotal });
    eventBus.emit('order.payment.completed', { orderNumber, total: calc.grandTotal });

    return order;
  }

  /**
   * Hold Sale (Park Cart)
   */
  public static async holdSale(
    cashierId: string,
    cashierName: string,
    branchId: string,
    cartItems: IHeldSale['cartItems'],
    customer?: { id?: string; name?: string },
    notes?: string
  ): Promise<IHeldSale> {
    const holdId = `HOLD-${Date.now()}`;
    const subtotal = cartItems.reduce((acc, item) => acc + item.total, 0);

    const held = await HeldSale.create({
      holdId,
      cashierId,
      cashierName,
      branchId: new mongoose.Types.ObjectId(branchId),
      customerId: customer?.id ? new mongoose.Types.ObjectId(customer.id) : undefined,
      customerName: customer?.name,
      cartItems,
      subtotal,
      notes,
    });

    logger.info(`[POS Service] Cart held with ID: ${holdId} by ${cashierName}`);
    return held;
  }

  /**
   * Resume Sale
   */
  public static async resumeSale(holdId: string): Promise<IHeldSale> {
    const held = await HeldSale.findOneAndDelete({ holdId });
    if (!held) {
      throw new Error(`Held sale ${holdId} not found.`);
    }
    return held;
  }

  /**
   * List all held sales for a cashier / branch
   */
  public static async getHeldSales(branchId: string): Promise<IHeldSale[]> {
    return HeldSale.find({ branchId: new mongoose.Types.ObjectId(branchId) }).sort({
      createdAt: -1,
    });
  }

  /**
   * Generate Receipt Metadata (58mm / 80mm printable layout)
   */
  public static async generateReceipt(
    orderNumberOrId: string,
    paperWidth: '58mm' | '80mm' = '80mm'
  ) {
    const order = await OmnichannelOrder.findOne(
      mongoose.isValidObjectId(orderNumberOrId)
        ? { $or: [{ orderNumber: orderNumberOrId }, { _id: orderNumberOrId }] }
        : { orderNumber: orderNumberOrId }
    );
    if (!order) {
      throw new Error(`Order #${orderNumberOrId} not found.`);
    }

    const tenant: any = order.tenantId
      ? (await Tenant.findById(order.tenantId).lean()) ||
        (await Tenant.findOne({ slug: order.tenantId }).lean())
      : null;
    const company: any = order.tenantId
      ? await Company.findOne({ tenantId: order.tenantId }).lean()
      : null;

    const businessName = tenant?.name || company?.name || 'Retail Store';
    const legalName = tenant?.legalName || company?.legalName;
    const logoUrl = tenant?.branding?.logoUrl || company?.logoUrl;
    const address = formatCleanAddress(tenant?.contact, company?.address);
    const phone = tenant?.contact?.phone || company?.phone || '';
    const email = tenant?.contact?.email || company?.email || '';
    const headerNotice = tenant?.branding?.receiptHeader || '';
    const footerNotice =
      tenant?.branding?.receiptFooter ||
      'Thank you for your patronage! Retain receipt for returns.';

    const receipt = {
      receiptNumber: `REC-${order.orderNumber}`,
      paperWidth,
      companyName: businessName,
      companyLegalName: legalName,
      companyLogoUrl: logoUrl,
      companyAddress: address,
      companyPhone: phone,
      companyEmail: email,
      companyTaxId: undefined,
      receiptHeader: headerNotice,
      receiptFooter: footerNotice,
      businessName,
      legalName,
      logoUrl,
      address,
      phone,
      email,
      taxId: undefined,
      headerNotice,
      header: {
        storeName: businessName,
        legalName,
        logoUrl,
        address,
        phone,
        email,
        taxId: undefined as string | undefined,
        headerNotice,
      },
      branchName: 'Central POS Branch',
      cashierName: order.cashierName || 'Cashier',
      date: order.createdAt,
      customerName: order.customerName || 'Walk-in Customer',
      customerEmail: order.customerEmail,
      pricingMode: (order as any).pricingMode || 'RETAIL',
      items: order.items.map((i) => ({
        name: i.name,
        productName: i.name,
        sku: i.sku,
        qty: i.quantity,
        quantity: i.quantity,
        priceTier: (i as any).priceTier || 'RETAIL',
        price: i.unitPrice,
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
        total: i.total,
      })),
      subtotal: order.subtotal,
      discount: order.discountTotal,
      tax: 0,
      total: order.grandTotal,
      payments: order.payments.map((p) => ({
        method: p.paymentMethod,
        amount: p.amount,
      })),
      footer: footerNotice,
      platformAttribution: 'Powered by Stockora Enterprise',
    };

    await Receipt.create({
      tenantId: order.tenantId,
      receiptNumber: receipt.receiptNumber,
      orderId: order.orderNumber,
      totalAmount: order.grandTotal,
      printedAt: new Date(),
      data: receipt,
    }).catch(() => {});

    return receipt;
  }

  public static async getReceiptData(orderNumberOrId: string) {
    return this.generateReceipt(orderNumberOrId);
  }

  /**
   * Offline Sync: Process queued offline transactions
   */
  public static async syncOfflineQueue(offlineTransactions: POSCheckoutInput[]): Promise<{
    syncedCount: number;
    errors: string[];
  }> {
    let syncedCount = 0;
    const errors: string[] = [];

    for (const tx of offlineTransactions) {
      try {
        await this.checkout(tx);
        syncedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Offline Tx (Key: ${tx.idempotencyKey || 'N/A'}): ${msg}`);
      }
    }

    logger.info(
      `[POS Service] Offline sync complete. Synced: ${syncedCount}, Errors: ${errors.length}`
    );
    return { syncedCount, errors };
  }
}
