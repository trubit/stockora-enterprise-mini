import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const analyticsRouter = Router();

// Secure all analytics routes under authenticated session
analyticsRouter.use(authMiddleware);

// 1. Executive Intelligence & Revenue
analyticsRouter.get(
  '/executive',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getExecutiveMetrics
);
analyticsRouter.get(
  '/revenue',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getExecutiveMetrics
);

// 2. Sales Trends & Channels
analyticsRouter.get(
  '/sales-trend',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getSalesTrend
);
analyticsRouter.get(
  '/channels',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getSalesChannels
);

// 3. Branches & Warehouses
analyticsRouter.get(
  '/branches',
  rbacMiddleware([SYSTEM_PERMISSIONS.BRANCHES_READ, SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getBranchPerformance
);
analyticsRouter.get(
  '/warehouses',
  rbacMiddleware([SYSTEM_PERMISSIONS.WAREHOUSES_READ, SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getWarehouseAnalytics
);

// 4. Inventory Intelligence, Stockouts & BCG Product Matrix
analyticsRouter.get(
  '/inventory-health',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  AnalyticsController.getInventoryIntelligence
);
analyticsRouter.get(
  '/stockouts',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  AnalyticsController.getStockoutAnalytics
);
analyticsRouter.get(
  '/products',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  AnalyticsController.getProductBCGMatrix
);

// 5. Customers & Cohorts
analyticsRouter.get(
  '/customers',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  AnalyticsController.getExecutiveMetrics
);
analyticsRouter.get(
  '/customer-cohorts',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  AnalyticsController.getCustomerCohorts
);

// 6. Procurement & Suppliers
analyticsRouter.get(
  '/procurement',
  rbacMiddleware([SYSTEM_PERMISSIONS.SUPPLIERS_READ, SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getExecutiveMetrics
);
analyticsRouter.get(
  '/suppliers',
  rbacMiddleware([SYSTEM_PERMISSIONS.SUPPLIERS_READ]),
  AnalyticsController.getSupplierScorecards
);

// 7. Cash Registers & Variance Audit
analyticsRouter.get(
  '/cash-registers',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ, SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getCashRegisterAnalytics
);

// 8. Health Score & Executive Summary
analyticsRouter.get(
  '/health-score',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getBusinessHealthScore
);
analyticsRouter.get(
  '/executive-summary',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getExecutiveSummary
);
analyticsRouter.get(
  '/briefing',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getDailyBriefing
);

// 9. Intelligence Alerts
analyticsRouter.get(
  '/alerts',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getBusinessAlerts
);
analyticsRouter.post(
  '/alerts/:id/ack',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_WRITE]),
  AnalyticsController.acknowledgeAlert
);

// 10. AI Decision Intelligence Hub
analyticsRouter.post(
  '/ai/assistant',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.askExecutiveAssistant
);
analyticsRouter.post(
  '/ai/forecast',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getAIForecast
);
analyticsRouter.post(
  '/ai/simulate-price',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.simulatePrice
);
analyticsRouter.post(
  '/ai/simulate-inventory',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.simulateInventory
);
analyticsRouter.post(
  '/ai/simulate-supplier',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.simulateSupplier
);

// 11. Dedicated Phase 46 Domain Analytics Endpoints
analyticsRouter.get(
  '/sales',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getSalesAnalytics
);
analyticsRouter.get(
  '/inventory',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  AnalyticsController.getInventoryAnalytics
);
analyticsRouter.get(
  '/customers',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  AnalyticsController.getCustomerAnalytics
);
analyticsRouter.get(
  '/suppliers',
  rbacMiddleware([SYSTEM_PERMISSIONS.SUPPLIERS_READ]),
  AnalyticsController.getSupplierAnalytics
);
analyticsRouter.get(
  '/finance',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ, SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getFinancialAnalytics
);
analyticsRouter.get(
  '/forecast',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getForecastAnalytics
);
analyticsRouter.get(
  '/anomalies',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getAnomalyAnalytics
);
analyticsRouter.get(
  '/kpis',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.getKPIMetrics
);
analyticsRouter.post(
  '/kpis/targets',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_WRITE]),
  AnalyticsController.updateKPITarget
);

// Alert lifecycle actions
analyticsRouter.post(
  '/alerts/:id/resolve',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_WRITE]),
  AnalyticsController.resolveAlert
);
analyticsRouter.post(
  '/alerts/:id/mute',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_WRITE]),
  AnalyticsController.muteAlert
);

// 12. Report & Data Export
analyticsRouter.post(
  '/export',
  rbacMiddleware([SYSTEM_PERMISSIONS.REPORTS_READ]),
  AnalyticsController.exportAnalyticsData
);
