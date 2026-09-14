import { Router } from 'express';
import { POSAdvancedController } from '../controllers/posAdvanced.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { requirePlanLimit } from '../middleware/billing.middleware.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const posAdvancedRouter = Router();

posAdvancedRouter.use(authMiddleware);

// Terminals
posAdvancedRouter.get(
  '/terminals',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  POSAdvancedController.listTerminals
);
posAdvancedRouter.post(
  '/terminals',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  requirePlanLimit('posTerminals'),
  POSAdvancedController.createTerminal
);

// Product Barcode Scan
posAdvancedRouter.get(
  '/scan/:query',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  POSAdvancedController.scanProduct
);

// Register Sessions & Cash Movements
posAdvancedRouter.post(
  '/register/open',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  POSAdvancedController.openRegisterSession
);
posAdvancedRouter.post(
  '/register/:id/cash-movement',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  POSAdvancedController.recordCashMovement
);
posAdvancedRouter.post(
  '/register/:id/close',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  POSAdvancedController.closeRegisterSession
);

// Hold & Resume Sales
posAdvancedRouter.get(
  '/held',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  POSAdvancedController.listHeldSales
);
posAdvancedRouter.post(
  '/hold',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  POSAdvancedController.holdSale
);
posAdvancedRouter.post(
  '/resume/:holdId',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  POSAdvancedController.resumeSale
);

// Thermal Receipt
posAdvancedRouter.get(
  '/receipt/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  POSAdvancedController.getThermalReceipt
);

// Offline Queue Sync
posAdvancedRouter.post(
  '/sync-offline',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  POSAdvancedController.syncOfflineQueue
);
