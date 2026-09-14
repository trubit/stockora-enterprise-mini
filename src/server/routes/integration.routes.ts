import { Router } from 'express';
import { IntegrationController } from '../controllers/integration.controller.js';
import { ApiKeyController } from '../controllers/apiKey.controller.js';
import { WebhookController } from '../controllers/webhook.controller.js';
import { ImportController } from '../controllers/import.controller.js';
import { ExportController } from '../controllers/export.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requirePlanFeature } from '../middleware/billing.middleware.js';

const router = Router();

// Public Webhook callbacks
router.post('/stripe-webhook', IntegrationController.stripeWebhook);
router.post('/paystack-webhook', IntegrationController.paystackWebhook);
router.get('/exports/download/:downloadToken', ExportController.downloadExport);

// Integration Hub Routes (optionalAuth allows catalog display even before login)
router.get('/', optionalAuth, IntegrationController.listIntegrations);
router.get('/audit-logs', authenticate, IntegrationController.getAuditLogs);
router.post('/:provider/configure', authenticate, IntegrationController.configureIntegration);
router.post('/:provider/test', authenticate, IntegrationController.testConnection);
router.post('/:provider/disconnect', authenticate, IntegrationController.disconnectIntegration);
router.post('/:provider/sync', authenticate, IntegrationController.triggerSync);
router.post('/sync', authenticate, IntegrationController.triggerSync);

// API Keys Management (Protected by Phase 44 plan-based check)
router.post(
  '/api-keys',
  authenticate,
  requirePlanFeature('apiAccess'),
  ApiKeyController.createApiKey
);
router.get(
  '/api-keys',
  authenticate,
  requirePlanFeature('apiAccess'),
  ApiKeyController.listApiKeys
);
router.post(
  '/api-keys/:keyId/revoke',
  authenticate,
  requirePlanFeature('apiAccess'),
  ApiKeyController.revokeApiKey
);
router.post(
  '/api-keys/:keyId/rotate',
  authenticate,
  requirePlanFeature('apiAccess'),
  ApiKeyController.rotateApiKey
);

// Outbound Webhooks Management
router.post('/webhooks', authenticate, WebhookController.createSubscription);
router.get('/webhooks', authenticate, WebhookController.listSubscriptions);
router.delete('/webhooks/:subscriptionId', authenticate, WebhookController.deleteSubscription);
router.get('/webhooks/logs', authenticate, WebhookController.getDeliveryLogs);
router.post('/webhooks/logs/:logId/replay', authenticate, WebhookController.replayDelivery);

// Import Wizard Routes
router.post('/imports/initialize', authenticate, ImportController.initializeImport);
router.post('/imports/:jobId/validate', authenticate, ImportController.validateImport);
router.post('/imports/:jobId/process', authenticate, ImportController.processImport);
router.get('/imports/:jobId', authenticate, ImportController.getImportJob);

// Export Center Routes
router.post('/exports/request', authenticate, ExportController.requestExport);
router.get('/exports', authenticate, ExportController.listExports);

export { router as integrationRouter };
