import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { RegionalSettings } from '../models/RegionalSettings.js';
import { Tenant } from '../models/Tenant.js';
import { Company } from '../models/Company.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { Customer } from '../models/Customer.js';
import { RegionalSettingsService } from '../services/regionalSettings.service.js';
import { ExchangeRateService } from '../services/exchangeRate.service.js';
import { TaxService } from '../services/tax.service.js';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatTime,
  MoneyMath,
} from '../../shared/formatters.js';
import { getCurrencyInfo, SUPPORTED_CURRENCIES } from '../../shared/currencies.js';
import { getCountryInfo, SUPPORTED_COUNTRIES } from '../../shared/countries.js';
import { i18n } from '../../client/i18n/i18n.js';
import { memoryCache } from '../utils/cache.js';
import { redis } from '../database/redis.js';

describe('Phase 47: Globalization, Multi-Currency, Tax & Regionalization System', () => {
  const tenantHarnId = new mongoose.Types.ObjectId().toString();
  const tenantHansonId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test_p47';
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    await RegionalSettings.deleteMany({ tenantId: { $in: [tenantHarnId, tenantHansonId] } });
    await ExchangeRate.deleteMany({ tenantId: { $in: [tenantHarnId, tenantHansonId] } });
    await Tenant.deleteMany({ _id: { $in: [tenantHarnId, tenantHansonId] } });
    await Company.deleteMany({ tenantId: { $in: [tenantHarnId, tenantHansonId] } });
    await Customer.deleteMany({ email: 'procurement@un.org' });
  });

  beforeEach(async () => {
    memoryCache.clear();
    if (redis && redis.status === 'ready') {
      try {
        await redis.del(`tenant:regional:${tenantHarnId}`, `tenant:regional:${tenantHansonId}`);
      } catch {}
    }
    await RegionalSettings.deleteMany({ tenantId: { $in: [tenantHarnId, tenantHansonId] } });
    await ExchangeRate.deleteMany({ tenantId: { $in: [tenantHarnId, tenantHansonId] } });
    await Tenant.deleteMany({ _id: { $in: [tenantHarnId, tenantHansonId] } });
    await Company.deleteMany({ tenantId: { $in: [tenantHarnId, tenantHansonId] } });
  });

  describe('1. Multi-Tenant Regional Settings Isolation (Harn vs Hanson)', () => {
    it('initializes separate regional settings for two different companies', async () => {
      // 1. Create Harn Company (Nigeria, NGN, Africa/Lagos, 7.5% VAT)
      await Tenant.create({
        _id: tenantHarnId,
        name: 'Harn Company Nigeria',
        slug: `harn-company-p47-1-${Date.now()}`,
        status: 'ACTIVE',
        businessType: 'Retail',
        contact: { email: 'ops@harn.ng', country: 'NG' },
        fiscalConfig: { currency: 'NGN', timezone: 'Africa/Lagos', locale: 'en-NG' },
        taxConfig: { taxRegistrationName: 'VAT', defaultTaxRate: 7.5, isTaxInclusive: true },
      });

      // 2. Create Hanson Company (United States, USD, America/New_York, 8.0% Sales Tax)
      await Tenant.create({
        _id: tenantHansonId,
        name: 'Hanson Global US',
        slug: `hanson-us-p47-1-${Date.now()}`,
        status: 'ACTIVE',
        businessType: 'Wholesale',
        contact: { email: 'ops@hanson.com', country: 'US' },
        fiscalConfig: { currency: 'USD', timezone: 'America/New_York', locale: 'en-US' },
        taxConfig: { taxRegistrationName: 'Sales Tax', defaultTaxRate: 8.0, isTaxInclusive: false },
      });

      const harnSettings = await RegionalSettingsService.getSettings(tenantHarnId);
      const hansonSettings = await RegionalSettingsService.getSettings(tenantHansonId);

      expect(harnSettings.countryCode).toBe('NG');
      expect(harnSettings.currency).toBe('NGN');
      expect(harnSettings.currencySymbol).toBe('₦');
      expect(harnSettings.timezone).toBe('Africa/Lagos');
      expect(harnSettings.taxConfig.defaultTaxRate).toBe(7.5);
      expect(harnSettings.taxConfig.isTaxInclusive).toBe(true);

      expect(hansonSettings.countryCode).toBe('US');
      expect(hansonSettings.currency).toBe('USD');
      expect(hansonSettings.currencySymbol).toBe('$');
      expect(hansonSettings.timezone).toBe('America/New_York');
      expect(hansonSettings.taxConfig.defaultTaxRate).toBe(8.0);
      expect(hansonSettings.taxConfig.isTaxInclusive).toBe(false);
    });

    it('modifying Harn settings never alters Hanson settings (strict tenant boundary)', async () => {
      await Tenant.create({
        _id: tenantHarnId,
        name: 'Harn Company Nigeria',
        slug: `harn-company-p47-2-${Date.now()}`,
        status: 'ACTIVE',
        businessType: 'Retail',
        contact: { email: 'ops2@harn.ng', country: 'NG' },
        fiscalConfig: { currency: 'NGN', timezone: 'Africa/Lagos', locale: 'en-NG' },
        taxConfig: { taxRegistrationName: 'VAT', defaultTaxRate: 7.5, isTaxInclusive: true },
      });

      await Tenant.create({
        _id: tenantHansonId,
        name: 'Hanson Global US',
        slug: `hanson-us-p47-2-${Date.now()}`,
        status: 'ACTIVE',
        businessType: 'Wholesale',
        contact: { email: 'ops2@hanson.com', country: 'US' },
        fiscalConfig: { currency: 'USD', timezone: 'America/New_York', locale: 'en-US' },
        taxConfig: { taxRegistrationName: 'Sales Tax', defaultTaxRate: 8.0, isTaxInclusive: false },
      });

      await RegionalSettingsService.getSettings(tenantHarnId);
      await RegionalSettingsService.getSettings(tenantHansonId);

      // Update Harn currency to GBP and tax to 20%
      await RegionalSettingsService.updateSettings(tenantHarnId, {
        currency: 'GBP',
        countryCode: 'GB',
        timezone: 'Europe/London',
        taxConfig: {
          taxRegistrationName: 'UK VAT',
          taxType: 'VAT',
          defaultTaxRate: 20.0,
          isTaxInclusive: true,
          taxExemptionAllowed: true,
          taxRates: [],
        },
      });

      const freshHarn = await RegionalSettingsService.getSettings(tenantHarnId);
      const freshHanson = await RegionalSettingsService.getSettings(tenantHansonId);

      expect(freshHarn.currency).toBe('GBP');
      expect(freshHarn.currencySymbol).toBe('£');
      expect(freshHarn.taxConfig.defaultTaxRate).toBe(20.0);

      // Hanson must remain completely untouched
      expect(freshHanson.currency).toBe('USD');
      expect(freshHanson.currencySymbol).toBe('$');
      expect(freshHanson.taxConfig.defaultTaxRate).toBe(8.0);
    });
  });

  describe('2. Currency Formatting, Precision & Deterministic Money Math', () => {
    it('formats currencies accurately with correct symbols and decimal precision', () => {
      // Valid locales
      const formattedUSD = formatCurrency(1250.5, 'USD', { locale: 'en-US' });
      expect(formattedUSD).toMatch(/\$1,250\.50/);

      const formattedGBP = formatCurrency(85.5, 'GBP', { locale: 'en-GB' });
      expect(formattedGBP).toMatch(/£85\.50/);

      const formattedNGN = formatCurrency(500000, 'NGN', { locale: 'en-NG' });
      expect(formattedNGN).toContain('500,000.00');

      // JPY -> 0 decimals
      const formattedJPY = formatCurrency(4500.8, 'JPY', { locale: 'ja-JP' });
      expect(formattedJPY).toMatch(/4,501|¥4,501/);

      // Resilient handling of malformed and legacy locales without throwing RangeError
      const formattedMalformed = formatCurrency(250, 'GBP', { locale: 'en-UNITED KINGDOM' });
      expect(formattedMalformed).toMatch(/£250\.00/);

      const formattedUnderscore = formatCurrency(100, 'USD', { locale: 'en_US' });
      expect(formattedUnderscore).toMatch(/\$100\.00/);

      const formattedInvalid = formatCurrency(50, 'USD', { locale: 'invalid-tag-123' });
      expect(formattedInvalid).toMatch(/\$50\.00/);

      // Null / undefined safety
      expect(formatCurrency(null, 'USD')).toBe('$0.00');
      expect(formatCurrency(undefined, 'USD')).toBe('$0.00');
    });

    it('performs deterministic decimal money calculations without floating point errors', () => {
      // 0.1 + 0.2 floating point standard hazard
      expect(0.1 + 0.2).not.toBe(0.3); // standard JS hazard
      expect(MoneyMath.add(0.1, 0.2)).toBe(0.3);

      expect(MoneyMath.subtract(10.55, 0.55)).toBe(10.0);
      expect(MoneyMath.multiply(19.99, 3)).toBe(59.97);
      expect(MoneyMath.toCents(19.99)).toBe(1999);
      expect(MoneyMath.fromCents(1999)).toBe(19.99);
      expect(MoneyMath.round(10.5555, 2)).toBe(10.56);
    });
  });

  describe('3. Multi-Currency Exchange Rate Engine & Resiliency', () => {
    it('calculates currency conversion using base rates and triangulation', async () => {
      const conversion = await ExchangeRateService.convertCurrency({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'NGN',
      });

      expect(conversion.fromCurrency).toBe('USD');
      expect(conversion.toCurrency).toBe('NGN');
      expect(conversion.originalAmount).toBe(100);
      expect(conversion.convertedAmount).toBeGreaterThan(0);
      expect(conversion.exchangeRate).toBeGreaterThan(0);
    });

    it('supports tenant-specific custom exchange rate overrides', async () => {
      // Set custom override rate: 1 USD = 1500 NGN for Harn
      await ExchangeRateService.setCustomRate({
        tenantId: tenantHarnId,
        baseCurrency: 'USD',
        targetCurrency: 'NGN',
        rate: 1500.0,
      });

      const harnConversion = await ExchangeRateService.convertCurrency({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        tenantId: tenantHarnId,
      });

      const defaultConversion = await ExchangeRateService.convertCurrency({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'NGN',
      });

      expect(harnConversion.convertedAmount).toBe(150000);
      expect(harnConversion.exchangeRate).toBe(1500);

      // Global rate is distinct from tenant custom override
      expect(defaultConversion.convertedAmount).toBeGreaterThan(0);
      expect(defaultConversion.provider).not.toBe('ManualAdmin');
    });

    it('rejects invalid, negative, or infinite exchange rates', async () => {
      await expect(
        ExchangeRateService.setCustomRate({
          tenantId: tenantHarnId,
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          rate: -5,
        })
      ).rejects.toThrow();

      await expect(
        ExchangeRateService.setCustomRate({
          tenantId: tenantHarnId,
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          rate: NaN,
        })
      ).rejects.toThrow();
    });
  });

  describe('4. Authoritative Server-Side Tax Calculation Engine', () => {
    it('calculates tax-exclusive pricing correctly', async () => {
      // $100.00 unit price, qty 2, 8% tax rate -> subtotal $200.00, tax $16.00, grand total $216.00
      const result = await TaxService.calculateTax({
        items: [{ unitPrice: 100, quantity: 2 }],
        overrideTaxInclusive: false,
      });

      expect(result.subtotal).toBe(200);
      expect(result.taxTotal).toBe(15); // Default rate 7.5%: 200 * 0.075 = 15.00
      expect(result.grandTotal).toBe(215);
      expect(result.isTaxInclusive).toBe(false);
    });

    it('calculates tax-inclusive pricing correctly (tax extracted without inflating price)', async () => {
      // ₦107.50 total price with 7.5% inclusive VAT -> Base = ₦100.00, Tax = ₦7.50, Grand Total = ₦107.50
      const result = await TaxService.calculateTax({
        items: [{ unitPrice: 107.5, quantity: 1 }],
        overrideTaxInclusive: true,
      });

      expect(result.subtotal).toBe(107.5);
      expect(result.taxableAmount).toBe(100.0);
      expect(result.taxTotal).toBe(7.5);
      expect(result.grandTotal).toBe(107.5);
      expect(result.isTaxInclusive).toBe(true);
    });

    it('handles multiple tax categories: Standard, Reduced, Zero-Rated, and Exempt', async () => {
      await RegionalSettings.create({
        tenantId: new mongoose.Types.ObjectId(tenantHarnId),
        currency: 'USD',
        taxConfig: {
          taxType: 'VAT',
          defaultTaxRate: 10.0,
          isTaxInclusive: false,
          taxExemptionAllowed: true,
          taxRates: [
            {
              name: 'Standard',
              code: 'STANDARD',
              ratePercentage: 10.0,
              category: 'STANDARD',
              isActive: true,
            },
            {
              name: 'Reduced Foods',
              code: 'REDUCED',
              ratePercentage: 5.0,
              category: 'REDUCED',
              isActive: true,
            },
            {
              name: 'Zero-Rated Essentials',
              code: 'ZERO_RATED',
              ratePercentage: 0,
              category: 'ZERO_RATED',
              isActive: true,
            },
            {
              name: 'Medical Exempt',
              code: 'EXEMPT',
              ratePercentage: 0,
              category: 'EXEMPT',
              isActive: true,
            },
          ],
        },
      });

      const result = await TaxService.calculateTax({
        tenantId: tenantHarnId,
        items: [
          { name: 'Standard Widget', unitPrice: 100, quantity: 1, taxCategory: 'STANDARD' }, // 10% -> tax 10
          { name: 'Reduced Food', unitPrice: 100, quantity: 1, taxCategory: 'REDUCED' }, // 5% -> tax 5
          { name: 'Essentials', unitPrice: 100, quantity: 1, taxCategory: 'ZERO_RATED' }, // 0% -> tax 0
          { name: 'Medicine', unitPrice: 100, quantity: 1, taxCategory: 'EXEMPT' }, // 0% -> tax 0
        ],
      });

      expect(result.subtotal).toBe(400);
      expect(result.taxTotal).toBe(15); // 10 + 5 + 0 + 0
      expect(result.grandTotal).toBe(415);
    });

    it('exempts verified tax-exempt customers from all tax obligations', async () => {
      const exemptCustomer = await Customer.create({
        name: 'UN Diplomatic Mission',
        email: 'procurement@un.org',
        code: 'CUST-EXEMPT-01',
        group: 'Diplomatic',
        creditLimit: 100000,
        loyaltyPoints: 0,
        isActive: true,
        isTaxExempt: true,
        taxExemptionNumber: 'DIPLOMAT-9988',
      } as any);

      const result = await TaxService.calculateTax({
        customerId: exemptCustomer._id.toString(),
        items: [{ unitPrice: 500, quantity: 2 }],
        overrideTaxInclusive: false,
      });

      expect(result.subtotal).toBe(1000);
      expect(result.taxTotal).toBe(0);
      expect(result.grandTotal).toBe(1000);
      expect(result.isExempt).toBe(true);
      expect(result.exemptionReason).toContain('DIPLOMAT-9988');
    });
  });

  describe('5. Timezone Localization & Boundary Formatting', () => {
    it('formats dates and times respecting target timezone and formats', () => {
      const testTimestamp = '2026-08-31T14:30:00Z';

      // Lagos (+1 UTC) -> 15:30
      const lagosTime = formatTime(testTimestamp, 'en-US', 'Africa/Lagos', '24h');
      expect(lagosTime).toContain('15:30');

      // New York (-4 EDT) -> 10:30
      const nyTime = formatTime(testTimestamp, 'en-US', 'America/New_York', '24h');
      expect(nyTime).toContain('10:30');

      // Tokyo (+9 UTC) -> 23:30
      const tokyoTime = formatTime(testTimestamp, 'en-US', 'Asia/Tokyo', '24h');
      expect(tokyoTime).toContain('23:30');

      // Null / invalid date safety
      expect(formatDate(null)).toBe('—');
      expect(formatTime(null)).toBe('—');
    });
  });

  describe('6. Frontend Internationalization (i18n) Completeness', () => {
    it('translates keys across supported languages with fallback to English', () => {
      // English
      i18n.setLanguage('en');
      expect(i18n.t('common.dashboard')).toBe('Dashboard');
      expect(i18n.t('pos.cart')).toBe('Cart');

      // Spanish
      i18n.setLanguage('es');
      expect(i18n.t('common.dashboard')).toBe('Panel de Control');
      expect(i18n.t('pos.cart')).toBe('Carrito');

      // French
      i18n.setLanguage('fr');
      expect(i18n.t('common.dashboard')).toBe('Tableau de bord');

      // German
      i18n.setLanguage('de');
      expect(i18n.t('common.dashboard')).toBe('Übersicht');

      // Arabic (RTL)
      i18n.setLanguage('ar');
      expect(i18n.t('common.dashboard')).toBe('لوحة التحكم');
      expect(i18n.isRTL()).toBe(true);

      // Yoruba
      i18n.setLanguage('yo');
      expect(i18n.t('common.dashboard')).toBe('Pẹpẹ Iṣakoso');
      expect(i18n.isRTL()).toBe(false);

      // Chinese
      i18n.setLanguage('zh');
      expect(i18n.t('common.dashboard')).toBe('仪表板');

      // Fallback on missing key
      expect(i18n.t('non.existent.key')).toBe('non.existent.key');

      // Reset to English
      i18n.setLanguage('en');
    });
  });
});
