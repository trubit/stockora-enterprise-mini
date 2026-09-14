import { Router } from 'express';
import { warehouseController } from '../controllers/warehouse.controller.js';
import { authenticate } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

export const warehouseRouter = Router();

warehouseRouter.use(authenticate);

// 1. Static & Sub-resource Root Endpoints (MUST be registered BEFORE GET /:id)

// Picking
warehouseRouter.get('/picking', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getPickLists(req, res, next)
);
warehouseRouter.get('/picking/:id', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getPickListById(req, res, next)
);
warehouseRouter.post('/picking', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.createPickList(req, res, next)
);
warehouseRouter.post('/picking/scan', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.scanAndPickItem(req, res, next)
);
warehouseRouter.post('/picking/short', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.handleShortPick(req, res, next)
);
warehouseRouter.post('/picking/wave', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.createWave(req, res, next)
);

// Put-away (Static)
warehouseRouter.post('/putaway/confirm', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.confirmPutAway(req, res, next)
);

// Allocation
warehouseRouter.post('/allocation', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.allocateOrder(req, res, next)
);
warehouseRouter.post('/allocation/:id/release', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.releaseAllocation(req, res, next)
);

// Packing
warehouseRouter.post('/packing', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.packOrder(req, res, next)
);

// Dispatch
warehouseRouter.post('/dispatch', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.createDispatchManifest(req, res, next)
);
warehouseRouter.post('/dispatch/:id/execute', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.executeDispatch(req, res, next)
);

// Transfers
warehouseRouter.post('/transfers', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.requestTransfer(req, res, next)
);
warehouseRouter.post('/transfers/:id/approve', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.approveTransfer(req, res, next)
);
warehouseRouter.post('/transfers/:id/ship', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.shipTransfer(req, res, next)
);
warehouseRouter.post('/transfers/:id/receive', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.receiveTransfer(req, res, next)
);

// Cycle Counting
warehouseRouter.post('/cycle-count', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.createCycleCount(req, res, next)
);
warehouseRouter.post('/cycle-count/:id/submit', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.submitCycleCount(req, res, next)
);
warehouseRouter.post('/cycle-count/:id/approve', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.approveCycleCount(req, res, next)
);

// 2. Base Warehouses Endpoints
warehouseRouter.get('/', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getWarehouses(req, res, next)
);
warehouseRouter.post('/', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.createWarehouse(req, res, next)
);

// 3. Parametric Warehouse Endpoints (GET /:id MUST be registered AFTER static paths)
warehouseRouter.get('/:id', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getWarehouseById(req, res, next)
);

// Zones & Locations by Warehouse ID
warehouseRouter.get('/:id/zones', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getZones(req, res, next)
);
warehouseRouter.post('/:id/zones', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.createZone(req, res, next)
);
warehouseRouter.get('/:id/locations', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getLocations(req, res, next)
);
warehouseRouter.post('/:id/locations', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.createLocation(req, res, next)
);

// Put-away by Warehouse ID
warehouseRouter.get('/:id/putaway/pending', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getPendingPutAway(req, res, next)
);
warehouseRouter.post('/:id/putaway/receipt', rbac(['warehouses:write']), (req, res, next) =>
  warehouseController.createPutAwayFromReceipt(req, res, next)
);

// Analytics & AI Insights by Warehouse ID
warehouseRouter.get('/:id/analytics', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getAnalytics(req, res, next)
);
warehouseRouter.get('/:id/ai-insights', rbac(['warehouses:read']), (req, res, next) =>
  warehouseController.getAIInsights(req, res, next)
);
