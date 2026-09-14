// ── All imports at the top (ESM best practice — no mid-file imports) ──────────
import { Router } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { authenticate } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';
import { SocketManager } from '../sockets/manager.js';
import { redis } from '../database/redis.js';

// Route module imports
import { authRouter } from './auth.routes.js';
import { tenantRouter } from './tenant.routes.js';
import { userRouter } from './user.routes.js';
import { orgRouter } from './org.routes.js';
import { productRouter } from './product.routes.js';
import { supplierRouter } from './supplier.routes.js';
import { customerRouter } from './customer.routes.js';
import { uploadRouter } from './upload.routes.js';
import { inventoryRouter } from './inventory.routes.js';
import { transferRouter } from './transfer.routes.js';
import { requisitionRouter } from './requisition.routes.js';
import { purchaseOrderRouter } from './purchaseOrder.routes.js';
import { invoiceRouter } from './invoice.routes.js';
import { quoteRouter } from './quote.routes.js';
import { salesOrderRouter } from './salesOrder.routes.js';
import { salesReturnRouter } from './salesReturn.routes.js';
import { financeRouter } from './finance.routes.js';
import { returnsRouter } from './returns.routes.js';
import { promoRouter } from './promo.routes.js';
import { notificationRouter } from './notification.routes.js';
import { branchSyncRouter } from './branchSync.routes.js';
import { automationRouter } from './automation.routes.js';
import { adminRouter } from './admin.routes.js';
import { securityRouter } from './security.routes.js';
import { resiliencyRouter } from './resiliency.routes.js';
import { aiRouter } from './ai.routes.js';
import { currencyRouter } from './currency.routes.js';
import { integrationRouter } from './integration.routes.js';
import { checkoutRouter } from './checkout.routes.js';
import { reportingRouter } from './reporting.routes.js';
import { workflowRouter } from './workflow.routes.js';
import { observabilityRouter } from './observability.routes.js';
import { copilotRouter } from './copilot.routes.js';
import { inventoryIntelligenceRouter } from './inventory-intelligence.routes.js';
import { crmRouter } from './crm.routes.js';
import { posRouter } from './pos.routes.js';
import { orderManagementRouter } from './order-management.routes.js';
import { accountingRouter } from './accounting.routes.js';
import { expenseRouter } from './expense.routes.js';
import { arApRouter } from './ar-ap.routes.js';
import { procurementRouter } from './procurement.routes.js';
import { warehouseRouter } from './warehouse.routes.js';
import { salesAdvancedRouter } from './salesAdvanced.routes.js';
import { procurementAdvancedRouter } from './procurementAdvanced.routes.js';
import { warehouseAdvancedRouter } from './warehouseAdvanced.routes.js';
import { procurementReplenishmentRouter } from './procurementReplenishment.routes.js';
import { posAdvancedRouter } from './posAdvanced.routes.js';
import { omnichannelCommerceRouter } from './omnichannelCommerce.routes.js';
import { analyticsRouter } from './analytics.routes.js';
import { billingRouter } from './billing.routes.js';
import { webhookRouter } from './webhook.routes.js';
import { regionalSettingsRouter } from './regionalSettings.routes.js';

// Model imports
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { Branch } from '../models/Branch.js';
import { Receipt } from '../models/Receipt.js';
import { Tenant } from '../models/Tenant.js';
import { Company } from '../models/Company.js';

// ── Router ────────────────────────────────────────────────────────────────────

const io = SocketManager.getInstance();

export const apiRouter = Router();

// ── Health Checks (Kubernetes Probes) ──────────────────────────────────────────
// Comprehensive health endpoint
apiRouter.get('/health', async (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const redisConnected = redis.status === 'ready';
  const isHealthy = dbConnected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    dbConnected,
    redisConnected,
    uptime: process.uptime(),
    pid: process.pid,
  });
});

// Liveness probe — verifies event loop responsiveness (avoids restart cascades during transient dependency blips)
apiRouter.get('/health/liveness', (_req, res) => {
  res.status(200).json({ status: 'alive', pid: process.pid, uptime: process.uptime() });
});

// Readiness probe — verifies database & cache readiness before receiving traffic
apiRouter.get('/health/readiness', (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const isReady = dbConnected;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    dbConnected,
    redisConnected: redis.status === 'ready',
    timestamp: new Date().toISOString(),
  });
});

// ── Transactions ──────────────────────────────────────────────────────────────
// GET /transactions — returns latest 100 transactions (cached in Redis for 60s per tenant)
apiRouter.get(
  '/transactions',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  async (req, res, next) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const tenantId = (req as any).tenantId || user?.tenantId;
      if (!tenantId) {
        res.json([]);
        return;
      }
      const cacheKey = `tenant:${tenantId}:transactions:all`;

      const cached = await redis.get(cacheKey);
      if (cached) {
        res.json(JSON.parse(cached));
        return;
      }

      const transactions = await Transaction.find({ tenantId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      await redis.setex(cacheKey, 60, JSON.stringify(transactions));
      res.json(transactions);
    } catch (err) {
      next(err);
    }
  }
);

// POST /transactions — creates a POS sale transaction with idempotency and tenant scoping
// SECURITY: Requires authentication and transactions:write permission — enforces tenant scoping
apiRouter.post(
  '/transactions',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  async (req, res, next) => {
    const { items, paymentMethod, discount, tax, subtotal, total, cashierName, branchName } =
      req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res
        .status(400)
        .json({ error: { message: 'Invalid transaction: must contain at least one item.' } });
      return;
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const tenantId = (req as any).tenantId || user?.tenantId;

      // Idempotency check — prevent duplicate charges/sales on network retry
      const idempotencyKey =
        (req.headers['idempotency-key'] as string) ||
        (req.headers['x-idempotency-key'] as string) ||
        req.body.idempotencyKey;
      if (idempotencyKey) {
        const existingQuery: Record<string, unknown> = { idempotencyKey };
        if (tenantId) existingQuery.tenantId = tenantId;
        const existingTx = await Transaction.findOne(existingQuery).lean();
        if (existingTx) {
          res.status(200).json(existingTx);
          return;
        }
      }

      // Process each item: deduct stock and emit real-time updates within tenant scope
      for (const item of items) {
        const isObjectId = mongoose.Types.ObjectId.isValid(item.productId);
        const query: Record<string, unknown> = isObjectId
          ? { $or: [{ _id: item.productId }, { sku: item.sku }] }
          : { sku: item.sku };

        if (tenantId) {
          query.tenantId = tenantId;
        }

        const product = await Product.findOne(query);
        if (product) {
          product.quantity = Math.max(0, product.quantity - item.quantity);
          await product.save();
          io.emitGlobal('product:stock-updated', {
            productId: product._id,
            quantity: product.quantity,
            tenantId,
          });

          if (product.quantity <= product.lowStockAlert) {
            io.emitGlobal('notification:low-stock', {
              productId: product._id,
              name: product.name,
              quantity: product.quantity,
              lowStockAlert: product.lowStockAlert,
              tenantId,
            });
          }
        }
      }

      const resolvedCashierId = user?.id || 'cashier-anonymous';
      const resolvedCashierName = cashierName || user?.username || 'POS Cashier';

      const branchQuery = tenantId ? { tenantId, isActive: true } : { isActive: true };
      const activeBranch = await Branch.findOne(branchQuery);
      const resolvedBranchId = activeBranch?._id?.toString() || 'branch-default';
      const resolvedBranchName = branchName || activeBranch?.name || 'Primary Branch';

      let validPaymentMethod = (paymentMethod || 'CASH').toString().toUpperCase().trim();
      if (
        validPaymentMethod === 'TRANSFER' ||
        validPaymentMethod === 'BANK' ||
        validPaymentMethod === 'MOBILE_TRANSFER'
      ) {
        validPaymentMethod = 'BANK_TRANSFER';
      } else if (
        validPaymentMethod === 'DEBIT' ||
        validPaymentMethod === 'CREDIT' ||
        validPaymentMethod === 'POS_CARD'
      ) {
        validPaymentMethod = 'CARD';
      }

      if (
        validPaymentMethod === 'PAYSTACK' ||
        validPaymentMethod === 'STRIPE' ||
        validPaymentMethod === 'ONLINE' ||
        validPaymentMethod.includes('SPLIT')
      ) {
        res.status(400).json({
          error: {
            message: `Payment method [${validPaymentMethod}] is not permitted for in-person POS sales. POS only accepts CASH, BANK_TRANSFER, and CARD.`,
            status: 400,
            code: 'VALIDATION_ERROR',
          },
        });
        return;
      }

      if (!['CASH', 'BANK_TRANSFER', 'CARD'].includes(validPaymentMethod)) {
        validPaymentMethod = 'CASH';
      }

      const mappedItems = items.map((item: any) => ({
        productId: String(item.productId || item.id || item._id || 'prod-item'),
        productName: String(item.productName || item.name || 'Item'),
        sku: String(item.sku || 'N/A'),
        quantity: Math.max(1, Number(item.quantity) || 1),
        price: Math.max(0, Number(item.price ?? item.unitPrice ?? 0)),
        discount: Math.max(0, Number(item.discount || 0)),
        total: Math.max(
          0,
          Number(
            item.total ?? item.lineTotal ?? Number(item.quantity || 1) * Number(item.price || 0)
          )
        ),
      }));

      const computedSubtotal =
        Number(subtotal) >= 0
          ? Number(subtotal)
          : mappedItems.reduce((acc: number, cur: any) => acc + cur.total, 0);
      const computedDiscount = Math.max(0, Number(discount || 0));
      const computedTax = Math.max(0, Number(tax || 0));
      const computedTotal =
        Number(total) >= 0
          ? Number(total)
          : Math.max(0, computedSubtotal + computedTax - computedDiscount);

      // Resolve tenant / company metadata
      const tenantRecord = tenantId
        ? (await Tenant.findById(tenantId).lean()) ||
          (await Tenant.findOne({ slug: tenantId }).lean())
        : null;
      const companyRecord: any = tenantId ? await Company.findOne({ tenantId }).lean() : null;
      const authUser = user as any;

      const resolvedCompanyName =
        tenantRecord?.name ||
        companyRecord?.name ||
        authUser?.tenantName ||
        authUser?.companyName ||
        'Retail Store';
      const resolvedCompanyLogo = tenantRecord?.branding?.logoUrl || companyRecord?.logoUrl;
      const resolvedCompanyAddress = (() => {
        const raw = tenantRecord?.contact
          ? [
              tenantRecord.contact.addressLine1,
              tenantRecord.contact.city,
              tenantRecord.contact.state,
              tenantRecord.contact.country &&
              tenantRecord.contact.country.trim().toUpperCase() !== 'US' &&
              tenantRecord.contact.country.trim().toUpperCase() !== 'USA'
                ? tenantRecord.contact.country.trim()
                : undefined,
            ]
              .filter(Boolean)
              .join(', ')
          : companyRecord?.address || '';
        if (!raw) return '';
        const upper = raw.trim().toUpperCase().replace(/[\.,]/g, '');
        if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES') return '';
        const cleaned = raw
          .trim()
          .replace(/,\s*(US|USA|United States)$/i, '')
          .trim();
        return cleaned.toUpperCase() === 'US' || cleaned.toUpperCase() === 'USA' ? '' : cleaned;
      })();
      const resolvedCompanyPhone = tenantRecord?.contact?.phone || companyRecord?.phone || '';
      const resolvedCompanyEmail = tenantRecord?.contact?.email || companyRecord?.email || '';
      const resolvedCompanyTaxId = tenantRecord?.taxConfig?.taxId || companyRecord?.taxId || '';
      const resolvedReceiptHeader = tenantRecord?.branding?.receiptHeader || '';
      const resolvedReceiptFooter =
        tenantRecord?.branding?.receiptFooter ||
        'Thank you for shopping with us! Please keep this receipt.';

      const newTransaction = await Transaction.create({
        tenantId,
        companyName: resolvedCompanyName,
        companyLogoUrl: resolvedCompanyLogo,
        companyAddress: resolvedCompanyAddress,
        companyPhone: resolvedCompanyPhone,
        companyEmail: resolvedCompanyEmail,
        companyTaxId: resolvedCompanyTaxId,
        receiptHeader: resolvedReceiptHeader,
        receiptFooter: resolvedReceiptFooter,
        idempotencyKey,
        transactionNumber: `TX-${Date.now().toString().slice(-6)}`,
        type: 'SALE',
        status: 'COMPLETED',
        items: mappedItems,
        subtotal: computedSubtotal,
        tax: computedTax,
        discount: computedDiscount,
        total: computedTotal,
        paymentMethod: validPaymentMethod,
        cashierId: resolvedCashierId,
        cashierName: resolvedCashierName,
        branchId: resolvedBranchId,
        branchName: resolvedBranchName,
      });

      // Invalidate Redis cache for affected tenant resources
      if (tenantId) {
        await redis.del([
          `tenant:${tenantId}:products:all`,
          `tenant:${tenantId}:transactions:all`,
          'products:all',
          'transactions:all',
        ]);
      } else {
        await redis.del(['products:all', 'transactions:all']);
      }

      await Receipt.create({
        tenantId,
        transactionId: newTransaction._id,
        transactionNumber: newTransaction.transactionNumber,
        customerEmail: newTransaction.customerEmail,
        branchId: newTransaction.branchId,
        cashierId: newTransaction.cashierId,
        data: {
          transactionNumber: newTransaction.transactionNumber,
          companyName: resolvedCompanyName,
          companyLogoUrl: resolvedCompanyLogo,
          companyAddress: resolvedCompanyAddress,
          companyPhone: resolvedCompanyPhone,
          companyEmail: resolvedCompanyEmail,
          companyTaxId: resolvedCompanyTaxId,
          receiptHeader: resolvedReceiptHeader,
          receiptFooter: resolvedReceiptFooter,
          items: newTransaction.items,
          subtotal: newTransaction.subtotal,
          tax: newTransaction.tax,
          discount: newTransaction.discount,
          total: newTransaction.total,
          paymentMethod: newTransaction.paymentMethod,
          cashierName: newTransaction.cashierName,
          branchName: newTransaction.branchName,
          createdAt: newTransaction.createdAt,
          platformAttribution: 'Powered by Stockora Enterprise',
        },
      });

      io.emitGlobal('transaction:completed', newTransaction);

      res.status(201).json(newTransaction);
    } catch (err) {
      next(err);
    }
  }
);

// GET /receipts — requires authentication, transactions:read permission, and enforces tenant boundaries
apiRouter.get(
  '/receipts',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  async (req, res, next) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const tenantId = user?.tenantId;
      const query = tenantId ? { tenantId } : {};
      const receipts = await Receipt.find(query).sort({ createdAt: -1 }).limit(100).lean();
      res.json(receipts);
    } catch (err) {
      next(err);
    }
  }
);

// ── Sub-Router Mounts ─────────────────────────────────────────────────────────
apiRouter.use('/auth', authRouter);
apiRouter.use('/tenants', tenantRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/org', orgRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/customers', customerRouter);
apiRouter.use('/upload', uploadRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/inventory-intelligence', inventoryIntelligenceRouter);
apiRouter.use('/crm', crmRouter);
apiRouter.use('/pos', posRouter);
apiRouter.use('/orders', orderManagementRouter);
apiRouter.use('/transfers', transferRouter);
apiRouter.use('/requisitions', requisitionRouter);
apiRouter.use('/purchase-orders', purchaseOrderRouter);
apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/quotes', quoteRouter);
apiRouter.use('/sales-orders', salesOrderRouter);
apiRouter.use('/sales-returns', salesReturnRouter);
apiRouter.use('/finance', financeRouter);
apiRouter.use('/accounting', accountingRouter);
apiRouter.use('/expenses', expenseRouter);
apiRouter.use('/ar-ap', arApRouter);
apiRouter.use('/procurement', procurementRouter);
apiRouter.use('/warehouses', warehouseRouter);
apiRouter.use('/returns', returnsRouter);
apiRouter.use('/marketing', promoRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/sync', branchSyncRouter);
apiRouter.use('/branch-sync', branchSyncRouter);
apiRouter.use('/automation', automationRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/security', securityRouter);
apiRouter.use('/resiliency', resiliencyRouter);
apiRouter.use('/ai', aiRouter);
apiRouter.use('/currency', currencyRouter);
apiRouter.use('/integrations', integrationRouter);
apiRouter.use('/checkout', checkoutRouter);
apiRouter.use('/reports', reportingRouter);
apiRouter.use('/workflows', workflowRouter);
apiRouter.use('/observability', observabilityRouter);
apiRouter.use('/copilot', copilotRouter);
apiRouter.use('/sales-advanced', salesAdvancedRouter);
apiRouter.use('/procurement-advanced', procurementAdvancedRouter);
apiRouter.use('/warehouse-advanced', warehouseAdvancedRouter);
apiRouter.use('/procurement-replenishment', procurementReplenishmentRouter);
apiRouter.use('/pos-advanced', posAdvancedRouter);
apiRouter.use('/omnichannel-commerce', omnichannelCommerceRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/webhooks', webhookRouter);
apiRouter.use('/', regionalSettingsRouter);
