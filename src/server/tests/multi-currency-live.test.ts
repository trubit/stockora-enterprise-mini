import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { ExchangeRateService, LiveExchangeRateProvider } from '../services/exchangeRate.service.js';
import { formatCurrency, MoneyMath, normalizeLocale } from '../../shared/formatters.js';
import { getCurrencyInfo, SUPPORTED_CURRENCIES } from '../../shared/currencies.js';
import { memoryCache } from '../utils/cache.js';

describe('Multi-Currency, Live Exchange Rate & Dynamic Conversion System', () => {
  const tenantAId = new mongoose.Types.ObjectId().toString();
  const tenantBId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri =
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test_multicurrency';
      try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
      } catch {
        // Continue in unit test mode if local mongod is not started
      }
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    memoryCache.clear();
    if (mongoose.connection.readyState === 1) {
      try {
        await ExchangeRate.deleteMany({});
      } catch {}
    }
  });

  describe('1. Currency Metadata & ISO Definitions', () => {
    it('supports all mandatory currencies with correct metadata', () => {
      const mandatoryCodes = [
        'NGN',
        'USD',
        'GBP',
        'EUR',
        'CAD',
        'AUD',
        'ZAR',
        'GHS',
        'KES',
        'AED',
        'INR',
        'JPY',
      ];

      for (const code of mandatoryCodes) {
        const info = getCurrencyInfo(code);
        expect(info).toBeDefined();
        expect(info.code).toBe(code);
        expect(info.symbol).toBeTruthy();
        expect(typeof info.decimalDigits).toBe('number');
      }

      expect(getCurrencyInfo('JPY').decimalDigits).toBe(0);
      expect(getCurrencyInfo('USD').decimalDigits).toBe(2);
      expect(getCurrencyInfo('NGN').decimalDigits).toBe(2);
      expect(getCurrencyInfo('NGN').symbol).toBe('₦');
      expect(getCurrencyInfo('USD').symbol).toBe('$');
      expect(getCurrencyInfo('GBP').symbol).toBe('£');
      expect(getCurrencyInfo('EUR').symbol).toBe('€');
    });

    it('normalizes currency codes with whitespace and lowercase characters safely', () => {
      expect(getCurrencyInfo(' ngn ').code).toBe('NGN');
      expect(getCurrencyInfo('usd').code).toBe('USD');
      expect(getCurrencyInfo('Gbp').code).toBe('GBP');
    });
  });

  describe('2. Rate Validation & Error Safety', () => {
    it('accepts valid positive finite numbers', () => {
      expect(() => ExchangeRateService.validateRate(1.0)).not.toThrow();
      expect(() => ExchangeRateService.validateRate(1450.5)).not.toThrow();
      expect(() => ExchangeRateService.validateRate(0.0001)).not.toThrow();
    });

    it('rejects negative, zero, NaN, Infinity, and non-numeric values', () => {
      expect(() => ExchangeRateService.validateRate(-1.5)).toThrow();
      expect(() => ExchangeRateService.validateRate(0)).toThrow();
      expect(() => ExchangeRateService.validateRate(NaN)).toThrow();
      expect(() => ExchangeRateService.validateRate(Infinity)).toThrow();
      expect(() => ExchangeRateService.validateRate(-Infinity)).toThrow();
    });
  });

  describe('3. LiveExchangeRateProvider & Canonical Rate Engine', () => {
    it('computes positive exchange rates between any pair of supported currencies', async () => {
      const provider = new LiveExchangeRateProvider();
      const rateUsdToNgn = await provider.fetchRate('USD', 'NGN');
      const rateNgnToUsd = await provider.fetchRate('NGN', 'USD');

      expect(rateUsdToNgn).toBeGreaterThan(0);
      expect(rateNgnToUsd).toBeGreaterThan(0);
      expect(rateUsdToNgn * rateNgnToUsd).toBeCloseTo(1.0, 4);

      const rateUsdToEur = await provider.fetchRate('USD', 'EUR');
      const rateEurToGbp = await provider.fetchRate('EUR', 'GBP');
      expect(rateUsdToEur).toBeGreaterThan(0);
      expect(rateEurToGbp).toBeGreaterThan(0);

      const identityRate = await provider.fetchRate('USD', 'USD');
      expect(identityRate).toBe(1.0);
    });

    it('fetches complete latest rates map relative to any specified base currency', async () => {
      const provider = new LiveExchangeRateProvider();
      const usdRates = await provider.fetchLatestRates('USD');
      expect(usdRates.USD).toBe(1.0);
      expect(usdRates.NGN).toBeGreaterThan(0);
      expect(usdRates.EUR).toBeGreaterThan(0);
      expect(usdRates.GBP).toBeGreaterThan(0);

      const ngnRates = await provider.fetchLatestRates('NGN');
      expect(ngnRates.NGN).toBe(1.0);
      expect(ngnRates.USD).toBeCloseTo(1 / usdRates.NGN, 4);
    });
  });

  describe('4. Currency Conversion & Mathematical Consistency', () => {
    it('converts amount accurately and maintains reverse conversion symmetry', async () => {
      const initialUSD = 100;
      const toNGN = await ExchangeRateService.convertCurrency({
        amount: initialUSD,
        fromCurrency: 'USD',
        toCurrency: 'NGN',
      });

      expect(toNGN.fromCurrency).toBe('USD');
      expect(toNGN.toCurrency).toBe('NGN');
      expect(toNGN.convertedAmount).toBeGreaterThan(0);

      const backToUSD = await ExchangeRateService.convertCurrency({
        amount: toNGN.convertedAmount,
        fromCurrency: 'NGN',
        toCurrency: 'USD',
      });

      // Round-trip conversion should be within 0.1% tolerance
      expect(backToUSD.convertedAmount).toBeCloseTo(initialUSD, 1);
    });

    it('handles zero and decimal amounts correctly', async () => {
      const zeroConversion = await ExchangeRateService.convertCurrency({
        amount: 0,
        fromCurrency: 'EUR',
        toCurrency: 'USD',
      });
      expect(zeroConversion.convertedAmount).toBe(0);

      const decimalConversion = await ExchangeRateService.convertCurrency({
        amount: 12.3456,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
      });
      expect(decimalConversion.convertedAmount).toBeGreaterThan(0);
    });

    it('applies JPY zero-decimal precision rounding rules', async () => {
      const jpyResult = await ExchangeRateService.convertCurrency({
        amount: 50.75,
        fromCurrency: 'USD',
        toCurrency: 'JPY',
      });
      expect(Number.isInteger(jpyResult.convertedAmount)).toBe(true);
    });

    it('rejects invalid or non-numeric amounts', async () => {
      await expect(
        ExchangeRateService.convertCurrency({
          amount: NaN,
          fromCurrency: 'USD',
          toCurrency: 'NGN',
        })
      ).rejects.toThrow();

      await expect(
        ExchangeRateService.convertCurrency({
          amount: Infinity,
          fromCurrency: 'USD',
          toCurrency: 'NGN',
        })
      ).rejects.toThrow();
    });
  });

  describe('5. Tenant Custom Rate Overrides & Cache Isolation', () => {
    it('allows tenant-specific custom override without polluting other tenants', async () => {
      // Set custom override for Tenant A (USD -> NGN = 1600.0)
      await ExchangeRateService.setCustomRate({
        tenantId: tenantAId,
        baseCurrency: 'USD',
        targetCurrency: 'NGN',
        rate: 1600.0,
        provider: 'HarnTreasuryOverride',
      });

      const convA = await ExchangeRateService.convertCurrency({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        tenantId: tenantAId,
      });
      expect(convA.convertedAmount).toBe(160000);
      expect(convA.provider).toBe('HarnTreasuryOverride');

      // Tenant B uses standard market rate
      const convB = await ExchangeRateService.convertCurrency({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        tenantId: tenantBId,
      });
      expect(convB.provider).not.toBe('HarnTreasuryOverride');
    });

    it('invalidates cache properly when custom rate is updated', async () => {
      await ExchangeRateService.setCustomRate({
        tenantId: tenantAId,
        baseCurrency: 'USD',
        targetCurrency: 'GBP',
        rate: 0.8,
      });

      let conv = await ExchangeRateService.convertCurrency({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'GBP',
        tenantId: tenantAId,
      });
      expect(conv.convertedAmount).toBe(80);

      // Update rate
      await ExchangeRateService.setCustomRate({
        tenantId: tenantAId,
        baseCurrency: 'USD',
        targetCurrency: 'GBP',
        rate: 0.85,
      });

      conv = await ExchangeRateService.convertCurrency({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'GBP',
        tenantId: tenantAId,
      });
      expect(conv.convertedAmount).toBe(85);
    });
  });

  describe('6. Resilient Monetary Formatting & Locale Safety', () => {
    it('formats currency safely with valid locales without RangeError', () => {
      expect(formatCurrency(1450000, 'NGN')).toContain('1,450,000');
      expect(formatCurrency(100, 'USD')).toContain('100.00');
      expect(formatCurrency(500, 'EUR')).toMatch(/500[,.]00/);
      expect(formatCurrency(250, 'GBP')).toContain('250.00');
      expect(formatCurrency(10000, 'JPY')).toContain('10,000');
    });

    it('repairs invalid / malformed locale strings safely', () => {
      expect(normalizeLocale('en-UNITED KINGDOM')).toBe('en-GB');
      expect(normalizeLocale('en_US')).toBe('en-US');
      expect(normalizeLocale(null)).toBe('en-US');
      expect(normalizeLocale('')).toBe('en-US');
      expect(normalizeLocale('invalid-locale-xyz')).toBe('en-US');
    });

    it('performs exact decimal money arithmetic without floating-point errors', () => {
      // 0.1 + 0.2 is 0.30000000000000004 in standard JS float arithmetic
      expect(0.1 + 0.2).not.toBe(0.3);
      expect(MoneyMath.add(0.1, 0.2)).toBe(0.3);
      expect(MoneyMath.subtract(0.3, 0.1)).toBe(0.2);
      expect(MoneyMath.multiply(100.05, 3)).toBe(300.15);
      expect(MoneyMath.round(10.005, 2)).toBe(10.01);
    });
  });
});
