import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth.js';
import { resolveTenantContext } from '../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { AIController } from '../controllers/ai.controller.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const aiRouter = Router();

// Dedicated rate limiter for AI operations: 25 requests per minute per client
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error:
      'AI request limit reached. Please wait a moment before sending additional analytical queries.',
  },
});

// Enforce authentication, tenant resolution, and rate limiting across all AI endpoints
aiRouter.use(authMiddleware);
aiRouter.use(resolveTenantContext);
aiRouter.use(aiRateLimiter);

// 1. Status & Health
aiRouter.get('/status', rbacMiddleware([SYSTEM_PERMISSIONS.AI_VIEW]), AIController.getStatus);

// 2. Interactive AI Assistant Chat
aiRouter.post(
  '/assistant',
  rbacMiddleware([SYSTEM_PERMISSIONS.AI_ANALYZE]),
  AIController.askAssistant
);

// 3. Inventory Intelligence & Valuation Radar
aiRouter.get(
  '/inventory-intelligence',
  rbacMiddleware([SYSTEM_PERMISSIONS.AI_INVENTORY]),
  AIController.getInventoryIntelligence
);

// 4. Smart Reorder Recommendations
aiRouter.get(
  '/reorders',
  rbacMiddleware([SYSTEM_PERMISSIONS.AI_RECOMMENDATIONS]),
  AIController.getReorderRecommendations
);

// 5. Demand & Stock Forecasting
aiRouter.get(
  '/forecast',
  rbacMiddleware([SYSTEM_PERMISSIONS.AI_FORECASTING]),
  AIController.getDemandForecast
);

// 6. Sales & Product Intelligence
aiRouter.get(
  '/sales-intelligence',
  rbacMiddleware([SYSTEM_PERMISSIONS.AI_SALES]),
  AIController.getSalesIntelligence
);

// 7. Operational Anomaly Detection
aiRouter.get(
  '/anomalies',
  rbacMiddleware([SYSTEM_PERMISSIONS.AI_INVENTORY]),
  AIController.getAnomalies
);

// 8. Executive Business Summary
aiRouter.get(
  '/summary',
  rbacMiddleware([SYSTEM_PERMISSIONS.AI_REPORTS]),
  AIController.getBusinessSummary
);
