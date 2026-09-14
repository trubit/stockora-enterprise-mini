import { Router } from 'express';
import { InventoryIntelligenceController } from '../controllers/inventory-intelligence.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const inventoryIntelligenceRouter = Router();

inventoryIntelligenceRouter.use(authMiddleware);

inventoryIntelligenceRouter.get(
  '/dashboard',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryIntelligenceController.getDashboardData
);

inventoryIntelligenceRouter.post(
  '/forecast',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  InventoryIntelligenceController.generateForecast
);

inventoryIntelligenceRouter.get(
  '/forecasts',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryIntelligenceController.getForecasts
);

inventoryIntelligenceRouter.post(
  '/replenish',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  InventoryIntelligenceController.calculateReplenishment
);

inventoryIntelligenceRouter.get(
  '/reorders',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryIntelligenceController.getReorders
);

inventoryIntelligenceRouter.post(
  '/reorders/:id/override',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  InventoryIntelligenceController.overrideReorder
);

inventoryIntelligenceRouter.get(
  '/suppliers',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryIntelligenceController.getSupplierScores
);

inventoryIntelligenceRouter.post(
  '/suppliers/evaluate',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  InventoryIntelligenceController.evaluateSuppliers
);

inventoryIntelligenceRouter.get(
  '/optimization',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryIntelligenceController.getOptimization
);

inventoryIntelligenceRouter.post(
  '/copilot/query',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryIntelligenceController.copilotQuery
);
