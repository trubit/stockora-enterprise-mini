import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { RegionalSettingsService } from '../services/regionalSettings.service.js';
import { ExchangeRateService } from '../services/exchangeRate.service.js';
import { TaxService } from '../services/tax.service.js';
import { SUPPORTED_CURRENCIES } from '../../shared/currencies.js';
import { SUPPORTED_COUNTRIES, SUPPORTED_TIMEZONES } from '../../shared/countries.js';
import { ValidationError, AuthorizationError } from '../errors/AppError.js';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Èdè Yorùbá', dir: 'ltr', flag: '🇳🇬' },
  { code: 'ha', name: 'Hausa', nativeName: 'Harshen Hausa', dir: 'ltr', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', nativeName: 'Asụsụ Igbo', dir: 'ltr', flag: '🇳🇬' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', dir: 'ltr', flag: '🇨🇳' },
];

export class RegionalSettingsController {
  /**
   * GET /api/v1/regional-settings
   */
  public static async getSettings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        throw new ValidationError('Tenant context is required.');
      }

      const settings = await RegionalSettingsService.getSettings(tenantId.toString());
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/regional-settings
   */
  public static async updateSettings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        throw new ValidationError('Tenant context is required.');
      }

      // Check authorization (Company Owner, Super Admin, or explicit permission)
      const user = req.user;
      const permissions = (user as any)?.permissions as string[] | undefined;
      const isPrivileged =
        user?.isPlatformAdmin ||
        user?.roleName === 'Super Administrator' ||
        user?.roleName === 'Company Owner' ||
        permissions?.includes('companies:write') ||
        permissions?.includes('settings:write');

      if (!isPrivileged) {
        throw new AuthorizationError('Insufficient permissions to modify regional settings.');
      }

      // Mass assignment protection: explicitly allow valid regional fields
      const {
        country,
        countryCode,
        currency,
        supportedCurrencies,
        timezone,
        language,
        dateFormat,
        timeFormat,
        numberFormat,
        firstDayOfWeek,
        measurementSystem,
        taxConfig,
      } = req.body;

      const safePayload: Record<string, unknown> = {};
      if (country !== undefined) safePayload.country = country;
      if (countryCode !== undefined) safePayload.countryCode = countryCode;
      if (currency !== undefined) safePayload.currency = currency;
      if (supportedCurrencies !== undefined) safePayload.supportedCurrencies = supportedCurrencies;
      if (timezone !== undefined) safePayload.timezone = timezone;
      if (language !== undefined) safePayload.language = language;
      if (dateFormat !== undefined) safePayload.dateFormat = dateFormat;
      if (timeFormat !== undefined) safePayload.timeFormat = timeFormat;
      if (numberFormat !== undefined) safePayload.numberFormat = numberFormat;
      if (firstDayOfWeek !== undefined) safePayload.firstDayOfWeek = firstDayOfWeek;
      if (measurementSystem !== undefined) safePayload.measurementSystem = measurementSystem;
      if (taxConfig !== undefined) safePayload.taxConfig = taxConfig;

      const updated = await RegionalSettingsService.updateSettings(
        tenantId.toString(),
        safePayload,
        user?.id
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/currencies
   */
  public static listCurrencies(_req: AuthenticatedRequest, res: Response): void {
    res.json(Object.values(SUPPORTED_CURRENCIES));
  }

  /**
   * GET /api/v1/countries
   */
  public static listCountries(_req: AuthenticatedRequest, res: Response): void {
    res.json(SUPPORTED_COUNTRIES);
  }

  /**
   * GET /api/v1/timezones
   */
  public static listTimezones(_req: AuthenticatedRequest, res: Response): void {
    res.json(SUPPORTED_TIMEZONES);
  }

  /**
   * GET /api/v1/languages
   */
  public static listLanguages(_req: AuthenticatedRequest, res: Response): void {
    res.json(SUPPORTED_LANGUAGES);
  }

  /**
   * GET /api/v1/exchange-rates
   */
  public static async getExchangeRates(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const baseCurrency = (req.query.base as string) || 'USD';
      const tenantId = req.tenantId?.toString() || req.user?.tenantId?.toString();
      const rates = await ExchangeRateService.getLatestRates(baseCurrency, tenantId);
      res.json({
        baseCurrency: baseCurrency.toUpperCase(),
        rates,
        fetchedAt: new Date(),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/exchange-rates/convert
   */
  public static async convertCurrency(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { amount, fromCurrency, toCurrency } = req.body;
      if (amount === undefined || !fromCurrency || !toCurrency) {
        throw new ValidationError('amount, fromCurrency, and toCurrency are required.');
      }

      const tenantId = req.tenantId?.toString() || req.user?.tenantId?.toString();
      const result = await ExchangeRateService.convertCurrency({
        amount: Number(amount),
        fromCurrency: String(fromCurrency),
        toCurrency: String(toCurrency),
        tenantId,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/exchange-rates/custom
   */
  public static async setCustomExchangeRate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId?.toString() || req.user?.tenantId?.toString();
      if (!tenantId) throw new ValidationError('Tenant context is required.');

      const user = req.user;
      const permissions = (user as any)?.permissions as string[] | undefined;
      const isPrivileged =
        user?.isPlatformAdmin ||
        user?.roleName === 'Super Administrator' ||
        user?.roleName === 'Company Owner' ||
        permissions?.includes('finance:write');

      if (!isPrivileged) {
        throw new AuthorizationError('Insufficient permissions to set custom exchange rates.');
      }

      const { baseCurrency, targetCurrency, rate } = req.body;
      const doc = await ExchangeRateService.setCustomRate({
        tenantId,
        baseCurrency: String(baseCurrency),
        targetCurrency: String(targetCurrency),
        rate: Number(rate),
      });

      res.json(doc);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/taxes/calculate
   */
  public static async calculateTax(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { items, customerId, overrideTaxInclusive } = req.body;
      if (!Array.isArray(items)) {
        throw new ValidationError('Line items array is required.');
      }

      const tenantId = req.tenantId?.toString() || req.user?.tenantId?.toString();
      const result = await TaxService.calculateTax({
        tenantId,
        items,
        customerId,
        overrideTaxInclusive,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
