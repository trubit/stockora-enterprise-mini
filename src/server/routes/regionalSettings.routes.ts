import { Router } from 'express';
import { RegionalSettingsController } from '../controllers/regionalSettings.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { resolveTenantContext } from '../middleware/tenant.middleware.js';

export const regionalSettingsRouter = Router();

// Public metadata lists (accessible openly or with optional auth)
regionalSettingsRouter.get('/currencies', optionalAuth, RegionalSettingsController.listCurrencies);
regionalSettingsRouter.get('/countries', optionalAuth, RegionalSettingsController.listCountries);
regionalSettingsRouter.get('/timezones', optionalAuth, RegionalSettingsController.listTimezones);
regionalSettingsRouter.get('/languages', optionalAuth, RegionalSettingsController.listLanguages);

// Tenant-scoped regional settings (strictly protected)
regionalSettingsRouter.get(
  '/regional-settings',
  authenticate,
  resolveTenantContext,
  RegionalSettingsController.getSettings
);
regionalSettingsRouter.patch(
  '/regional-settings',
  authenticate,
  resolveTenantContext,
  RegionalSettingsController.updateSettings
);

// Multi-currency exchange rate & conversion endpoints
// GET /exchange-rates accepts optional auth so market rates are served publicly, while tenant overrides apply if authenticated
regionalSettingsRouter.get(
  '/exchange-rates',
  optionalAuth,
  RegionalSettingsController.getExchangeRates
);
regionalSettingsRouter.post(
  '/exchange-rates/convert',
  optionalAuth,
  RegionalSettingsController.convertCurrency
);
regionalSettingsRouter.post(
  '/exchange-rates/custom',
  authenticate,
  resolveTenantContext,
  RegionalSettingsController.setCustomExchangeRate
);

// Server-side tax calculation
regionalSettingsRouter.post(
  '/taxes/calculate',
  authenticate,
  resolveTenantContext,
  RegionalSettingsController.calculateTax
);
