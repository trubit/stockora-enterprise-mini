import { Router } from 'express';
import { ProcurementReplenishmentController } from '../controllers/procurementReplenishment.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const procurementReplenishmentRouter = Router();

procurementReplenishmentRouter.use(authMiddleware);

// Contracts
procurementReplenishmentRouter.get(
  '/contracts',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  ProcurementReplenishmentController.listContracts
);
procurementReplenishmentRouter.post(
  '/contracts',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.createContract
);

// Supplier Ranking
procurementReplenishmentRouter.get(
  '/supplier-ranking/:productId',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  ProcurementReplenishmentController.rankSuppliers
);

// Replenishment Rules & Recommendations
procurementReplenishmentRouter.get(
  '/rules',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  ProcurementReplenishmentController.listReplenishmentRules
);
procurementReplenishmentRouter.post(
  '/rules',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.createOrUpdateReplenishmentRule
);
procurementReplenishmentRouter.get(
  '/recommendations',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  ProcurementReplenishmentController.listRecommendations
);
procurementReplenishmentRouter.post(
  '/calculate-recommendation',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.calculateProductReplenishment
);
procurementReplenishmentRouter.post(
  '/recommendations/:id/convert-pr',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.convertRecommendationToPR
);

// PO Versioning & Counter Proposals
procurementReplenishmentRouter.post(
  '/purchase-orders/:id/revise',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.revisePO
);
procurementReplenishmentRouter.post(
  '/purchase-orders/:id/acknowledge',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.acknowledgePO
);
procurementReplenishmentRouter.post(
  '/purchase-orders/:id/resolve-counter',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.resolveCounterProposal
);

// Landed Costs
procurementReplenishmentRouter.get(
  '/landed-costs',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  ProcurementReplenishmentController.listLandedCosts
);
procurementReplenishmentRouter.post(
  '/landed-costs',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.applyLandedCost
);

// Procurement Budgets
procurementReplenishmentRouter.get(
  '/budgets',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  ProcurementReplenishmentController.listBudgets
);
procurementReplenishmentRouter.post(
  '/budgets',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  ProcurementReplenishmentController.createBudget
);
