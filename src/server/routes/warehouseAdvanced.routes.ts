import { Router } from 'express';
import { WarehouseAdvancedController } from '../controllers/warehouseAdvanced.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const warehouseAdvancedRouter = Router();

warehouseAdvancedRouter.use(authMiddleware);

// Warehouses & Locations
warehouseAdvancedRouter.get(
  '/warehouses',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  WarehouseAdvancedController.listWarehouses
);
warehouseAdvancedRouter.post(
  '/warehouses',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.createWarehouse
);
warehouseAdvancedRouter.get(
  '/locations',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  WarehouseAdvancedController.listLocations
);
warehouseAdvancedRouter.post(
  '/locations',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.createLocation
);

// Inter-Warehouse Transfers
warehouseAdvancedRouter.get(
  '/transfers',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  WarehouseAdvancedController.listTransfers
);
warehouseAdvancedRouter.post(
  '/transfers',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.createTransfer
);
warehouseAdvancedRouter.post(
  '/transfers/:id/approve',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.approveTransfer
);
warehouseAdvancedRouter.post(
  '/transfers/:id/dispatch',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.dispatchTransfer
);
warehouseAdvancedRouter.post(
  '/transfers/:id/receive',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.receiveTransfer
);

// Picking Engine
warehouseAdvancedRouter.get(
  '/picking',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  WarehouseAdvancedController.listPickTasks
);
warehouseAdvancedRouter.post(
  '/picking',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.createPickTask
);
warehouseAdvancedRouter.post(
  '/picking/execute',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.executePickItem
);

// Packing Station
warehouseAdvancedRouter.get(
  '/packages',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  WarehouseAdvancedController.listPackages
);
warehouseAdvancedRouter.post(
  '/pack',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.packOrder
);

// Dispatch & Manifests
warehouseAdvancedRouter.get(
  '/manifests',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  WarehouseAdvancedController.listManifests
);
warehouseAdvancedRouter.post(
  '/manifests',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.createManifest
);
warehouseAdvancedRouter.post(
  '/manifests/:id/verify',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.verifyPackageLoaded
);
warehouseAdvancedRouter.post(
  '/manifests/:id/dispatch',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.executeDispatch
);

// Stock Counting & Reconciliation
warehouseAdvancedRouter.get(
  '/counts',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  WarehouseAdvancedController.listCounts
);
warehouseAdvancedRouter.post(
  '/counts',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.createCount
);
warehouseAdvancedRouter.post(
  '/counts/submit',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.submitCountResults
);
warehouseAdvancedRouter.post(
  '/counts/:id/reconcile',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.approveCountReconciliation
);

// Dispositions & Exceptions
warehouseAdvancedRouter.post(
  '/dispositions',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  WarehouseAdvancedController.processDisposition
);

// Analytics & AI Slotting
warehouseAdvancedRouter.get(
  '/analytics',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  WarehouseAdvancedController.getAnalytics
);
