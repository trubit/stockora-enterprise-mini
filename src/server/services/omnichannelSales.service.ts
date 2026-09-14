import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { CustomerCreditExposure } from '../models/CustomerCreditExposure.js';
import {
  SalesTransaction,
  type ISalesTransaction,
  type SalesChannelType,
} from '../models/SalesTransaction.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { SalesOrderHold } from '../models/SalesOrderHold.js';
import { Backorder } from '../models/Backorder.js';
import { StockMovement } from '../models/StockMovement.js';
import { InventoryReservation } from '../models/InventoryReservation.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface OmnichannelCheckoutInput {
  tenantId?: string;
  companyId?: string;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
  registerSessionId?: string;
  channel: SalesChannelType;
  customerId?: string;
  customerName?: string;
  cashierId?: string;
  cashierName?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice?: number;
    discountAmount?: number;
  }[];
  payments: {
    method:
      | 'CASH'
      | 'CARD'
      | 'BANK_TRANSFER'
      | 'MOBILE_PAYMENT'
      | 'WALLET'
      | 'PAYSTACK'
      | 'CREDIT'
      | 'OTHER';
    amount: number;
    referenceNumber?: string;
  }[];
  idempotencyKey?: string;
  managerOverrideBy?: string;
  notes?: string;
}

export class OmnichannelSalesService {
  public static async validateAndExecuteCheckout(
    input: OmnichannelCheckoutInput
  ): Promise<ISalesTransaction> {
    const tenantId = input.tenantId || 'default';

    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existing = await SalesTransaction.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) return existing;
    }

    // 2. Validate Items & Inventory Availability
    const preparedItems = [];
    let subtotal = 0;
    let discountTotal = 0;

    for (const itemInput of input.items) {
      const product = await Product.findById(itemInput.productId);
      if (!product) throw new NotFoundError(`Product not found (ID: ${itemInput.productId})`);

      if ((product.quantity || 0) < itemInput.quantity) {
        throw new ValidationError(
          `Insufficient stock for product "${product.name}". Required: ${itemInput.quantity}, Available: ${product.quantity || 0}`
        );
      }

      const unitPrice =
        itemInput.unitPrice !== undefined ? itemInput.unitPrice : product.price || 10;
      const unitCost = product.costPrice || 0;
      const discountAmount = itemInput.discountAmount || 0;
      const lineTotal = itemInput.quantity * unitPrice - discountAmount;

      subtotal += itemInput.quantity * unitPrice;
      discountTotal += discountAmount;

      preparedItems.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        quantity: itemInput.quantity,
        unitPrice,
        unitCost,
        discountAmount,
        taxRate: 0,
        taxAmount: 0,
        lineTotal,
      });
    }

    const taxTotal = 0;
    const totalAmount = subtotal - discountTotal;

    // 3. Payment Allocation Reconcilation Check
    const totalPaid = input.payments.reduce((acc, p) => acc + p.amount, 0);
    const creditPayment = input.payments.find((p) => p.method === 'CREDIT');

    if (creditPayment && input.customerId) {
      // Validate B2B Customer Credit Limit
      const exposure = await CustomerCreditExposure.findOne({ customerId: input.customerId });
      const currentExp = exposure?.currentExposure || 0;
      const limit = exposure?.creditLimit || 0;
      if (currentExp + creditPayment.amount > limit && !input.managerOverrideBy) {
        throw new ValidationError(
          `B2B Credit Limit Exceeded! Limit: $${limit}, Current Exposure: $${currentExp}, Requested: $${creditPayment.amount}`
        );
      }
    } else if (totalPaid < totalAmount && input.channel !== 'B2B') {
      throw new ValidationError(
        `Insufficient payment allocated. Order Total: $${totalAmount}, Paid: $${totalPaid}`
      );
    }

    // 4. Generate Unique Order / Transaction Number
    const prefix = input.channel === 'POS' ? 'POS' : input.channel === 'B2B' ? 'B2B' : 'ORD';
    const transactionNumber = `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // 5. Create Transaction Record
    const transaction = await SalesTransaction.create({
      tenantId,
      companyId: parseObjectId(input.companyId),
      branchId: parseObjectId(input.branchId),
      warehouseId: parseObjectId(input.warehouseId),
      terminalId: parseObjectId(input.terminalId),
      registerSessionId: parseObjectId(input.registerSessionId),
      channel: input.channel,
      transactionNumber,
      idempotencyKey: input.idempotencyKey,
      customerId: parseObjectId(input.customerId),
      customerName: input.customerName || 'Guest Customer',
      isGuest: !input.customerId,
      cashierId: parseObjectId(input.cashierId),
      cashierName: input.cashierName || 'Sales Agent',
      items: preparedItems,
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      currency: 'USD',
      payments: input.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        referenceNumber: p.referenceNumber || `REF-${Date.now().toString().slice(-6)}`,
        status: 'SUCCESS',
        paidAt: new Date(),
      })),
      status: 'COMPLETED',
      notes: input.notes,
      managerOverrideBy: parseObjectId(input.managerOverrideBy),
    });

    // 6. Update Product Inventory & Audit Ledger
    for (const item of preparedItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: -item.quantity },
      });

      await StockMovement.create({
        tenantId,
        companyId: parseObjectId(input.companyId),
        productId: item.productId,
        warehouseId: parseObjectId(input.warehouseId),
        quantity: -item.quantity,
        type: 'SALE',
        referenceId: transactionNumber,
        notes: `Omnichannel checkout (${input.channel}) - ${transactionNumber}`,
      });
    }

    // 7. Update Customer Total Spending if registered customer
    if (input.customerId && mongoose.isValidObjectId(input.customerId)) {
      await Customer.findByIdAndUpdate(input.customerId, {
        $inc: { totalSpending: totalAmount, totalOrders: 1 },
        lastPurchaseDate: new Date(),
      });
    }

    eventBus.emit('pos.sale.completed', {
      transactionId: transaction._id,
      transactionNumber,
      channel: input.channel,
      totalAmount,
    });

    return transaction;
  }

  public static async processSalesReturn(input: {
    transactionId: string;
    items: { productId: string; quantity: number; returnReason: string }[];
    refundMethod: 'CASH' | 'CARD' | 'STORE_CREDIT';
    inventoryDisposition: 'RESTOCK' | 'QUARANTINE' | 'DAMAGED';
    processedBy?: string;
  }): Promise<any> {
    const tx = await SalesTransaction.findById(input.transactionId);
    if (!tx) throw new NotFoundError('Original sales transaction not found');

    let totalRefund = 0;

    for (const retItem of input.items) {
      const item = tx.items.find((i: any) => i.productId?.toString() === retItem.productId);
      if (item) {
        const unitRefund = item.unitPrice;
        totalRefund += unitRefund * retItem.quantity;

        if (input.inventoryDisposition === 'RESTOCK') {
          await Product.findByIdAndUpdate(retItem.productId, {
            $inc: { quantity: retItem.quantity },
          });
        }
      }
    }

    tx.status = 'PARTIALLY_REFUNDED';
    await tx.save();

    eventBus.emit('sale.return.completed', {
      transactionId: tx._id,
      totalRefund,
      disposition: input.inventoryDisposition,
    });

    return {
      returnNumber: `RET-${Date.now().toString().slice(-6)}`,
      totalRefund,
      refundMethod: input.refundMethod,
      disposition: input.inventoryDisposition,
      status: 'COMPLETED',
    };
  }

  public static async createOrder(input: {
    tenantId?: string;
    companyId?: string;
    channelId?: string;
    channelCode?: string;
    customerId?: string;
    items: { productId: string; quantity: number; price?: number }[];
    idempotencyKey?: string;
    allowBackorders?: boolean;
    notes?: string;
  }): Promise<any> {
    const tenantId = input.tenantId || 'default';

    if (input.idempotencyKey) {
      const existing = await SalesOrder.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) return existing;
    }

    let subtotal = 0;
    const preparedItems = [];
    let isBackorderRequired = false;

    for (const itemInput of input.items) {
      const product = await Product.findById(itemInput.productId);
      if (!product) throw new NotFoundError(`Product ${itemInput.productId} not found`);

      const price = itemInput.price !== undefined ? itemInput.price : product.price || 10;
      const lineTotal = itemInput.quantity * price;
      subtotal += lineTotal;

      const avail = product.quantity || 0;
      if (avail < itemInput.quantity) {
        isBackorderRequired = true;
      }

      preparedItems.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        quantity: itemInput.quantity,
        price,
        discount: 0,
        tax: 0,
        shippedQuantity: 0,
      });
    }

    const total = subtotal;
    const orderNumber = `STK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Check Credit Limit
    let isCreditExceeded = false;
    if (input.customerId && mongoose.isValidObjectId(input.customerId)) {
      const customer = await Customer.findById(input.customerId);
      const exposure = await CustomerCreditExposure.findOne({ customerId: input.customerId });
      const limit = exposure?.creditLimit ?? customer?.creditLimit ?? 0;
      const current = exposure?.currentExposure ?? 0;
      if (limit > 0 && current + total > limit) {
        isCreditExceeded = true;
      }
    }

    const initialStatus = isCreditExceeded ? 'ON_HOLD' : 'APPROVED';

    const order = await SalesOrder.create({
      tenantId,
      companyId: input.companyId,
      orderNumber,
      channelId: parseObjectId(input.channelId),
      channelCode: input.channelCode || 'POS',
      customerId: parseObjectId(input.customerId),
      items: preparedItems,
      subtotal,
      tax: 0,
      discount: 0,
      total,
      currency: 'USD',
      paymentStatus: 'UNPAID',
      creditApproved: !isCreditExceeded,
      status: initialStatus,
      idempotencyKey: input.idempotencyKey,
    });

    if (isCreditExceeded) {
      await SalesOrderHold.create({
        tenantId,
        companyId: input.companyId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        reason: 'CREDIT_LIMIT_EXCEEDED',
        status: 'ACTIVE',
        details: `Order total $${total} exceeds credit limit`,
        createdBy: parseObjectId(input.customerId) || new mongoose.Types.ObjectId(),
        createdByName: 'System Credit Engine',
      });
    }

    // Handle Backorders if allowed and quantity exceeds stock
    if (isBackorderRequired && input.allowBackorders) {
      for (const itemInput of input.items) {
        const product = await Product.findById(itemInput.productId);
        const avail = product?.quantity || 0;
        if (avail < itemInput.quantity) {
          const backorderQty = itemInput.quantity - avail;
          await Backorder.create({
            tenantId,
            companyId: input.companyId,
            orderId: order._id,
            orderNumber: order.orderNumber,
            productId: itemInput.productId,
            sku: product?.sku || 'SKU-BACKORDER',
            requestedQuantity: itemInput.quantity,
            availableQuantity: Math.max(0, avail),
            backorderQuantity: backorderQty,
            status: 'PENDING',
          });
        }
      }
    }

    return order;
  }

  public static async releaseOrderHold(
    holdId: string,
    releasedBy = 'system',
    releasedByName = 'System Admin'
  ): Promise<any> {
    const hold = await SalesOrderHold.findById(holdId);
    if (!hold) throw new NotFoundError('Sales order hold record not found');

    hold.status = 'RELEASED';
    hold.releasedBy = releasedBy;
    hold.releasedAt = new Date();
    await hold.save();

    await SalesOrder.findByIdAndUpdate(hold.orderId, {
      status: 'APPROVED',
      creditApproved: true,
    });

    return hold;
  }

  public static async getOrders(tenantId = 'default', companyId?: string): Promise<any[]> {
    const query: any = { tenantId };
    if (companyId) query.companyId = companyId;
    return await SalesOrder.find(query).sort({ createdAt: -1 }).lean();
  }

  public static async cancelOrder(orderId: string, reason?: string): Promise<any> {
    const order = await SalesOrder.findById(orderId);
    if (!order) throw new NotFoundError('Sales order not found');
    order.status = 'CANCELLED';
    if (reason)
      order.notes = (order.notes ? order.notes + ' | ' : '') + `Cancellation Reason: ${reason}`;
    await order.save();
    return order;
  }

  public static async getOrderById(orderId: string): Promise<any> {
    const order = await SalesOrder.findById(orderId);
    if (!order) {
      return await SalesTransaction.findById(orderId);
    }
    return order;
  }
}
