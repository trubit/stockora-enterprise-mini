import { Router } from 'express';
import { CRMController } from '../controllers/crm.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const crmRouter = Router();

crmRouter.use(authMiddleware);

// 1. Dashboard & Customer 360
crmRouter.get(
  '/dashboard',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getDashboardData
);

crmRouter.get(
  '/customers/:id/360',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getCustomer360
);

crmRouter.get(
  '/customers/:id/overview',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getCustomer360
);

crmRouter.get(
  '/customers/:id/timeline',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getCustomer360
);

crmRouter.post(
  '/customers/:id/recalculate',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CRMController.recalculateMetrics
);

crmRouter.get(
  '/customers/:id/export',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.exportCustomerData
);

crmRouter.post(
  '/customers/merge',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CRMController.mergeCustomers
);

// 2. Segments & Preview
crmRouter.get(
  '/segments',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getSegments
);

crmRouter.post(
  '/segments',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CRMController.createSegment
);

crmRouter.post(
  '/segments/preview',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.previewSegment
);

// 3. Campaigns & Lifecycle
crmRouter.get(
  '/campaigns',
  rbacMiddleware([SYSTEM_PERMISSIONS.PROMOTIONS_READ]),
  CRMController.getCampaigns
);

crmRouter.post(
  '/campaigns',
  rbacMiddleware([SYSTEM_PERMISSIONS.PROMOTIONS_WRITE]),
  CRMController.createCampaign
);

crmRouter.post(
  '/campaigns/:id/dispatch',
  rbacMiddleware([SYSTEM_PERMISSIONS.PROMOTIONS_WRITE]),
  CRMController.dispatchCampaign
);

crmRouter.post(
  '/campaigns/:id/send',
  rbacMiddleware([SYSTEM_PERMISSIONS.PROMOTIONS_WRITE]),
  CRMController.dispatchCampaign
);

// 4. Loyalty Rewards & Redemptions
crmRouter.get(
  '/loyalty/rewards',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getLoyaltyRewards
);

crmRouter.post(
  '/loyalty/rewards',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CRMController.createLoyaltyReward
);

crmRouter.post(
  '/loyalty/earn',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CRMController.earnLoyaltyPoints
);

crmRouter.post(
  '/loyalty/redeem',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CRMController.redeemLoyaltyPoints
);

crmRouter.post(
  '/referrals',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CRMController.processReferral
);

// 5. Retention Radar & Churn Intelligence
crmRouter.get(
  '/retention',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getRetentionRadar
);

crmRouter.get(
  '/churn',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getRetentionRadar
);

// 6. AI Recommendations & Assistant
crmRouter.get(
  '/customers/:id/recommendations',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getRecommendations
);

crmRouter.post(
  '/ai/assistant',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.askCRMAssistant
);

crmRouter.post(
  '/copilot/query',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.askCRMAssistant
);

// 7. Customer Journeys
crmRouter.get(
  '/journeys',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CRMController.getJourneys
);

crmRouter.post(
  '/journeys',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CRMController.createJourney
);

// 8. Promotional Coupons & Discounts
crmRouter.get(
  '/coupons',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ, SYSTEM_PERMISSIONS.PROMOTIONS_READ]),
  CRMController.getCoupons
);

crmRouter.post(
  '/coupons',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE, SYSTEM_PERMISSIONS.PROMOTIONS_WRITE]),
  CRMController.createCoupon
);

crmRouter.patch(
  '/coupons/:id/toggle',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE, SYSTEM_PERMISSIONS.PROMOTIONS_WRITE]),
  CRMController.toggleCoupon
);

crmRouter.delete(
  '/coupons/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE, SYSTEM_PERMISSIONS.PROMOTIONS_WRITE]),
  CRMController.deleteCoupon
);
