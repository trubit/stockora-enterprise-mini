import { ExchangeRate, type IExchangeRate } from '../models/ExchangeRate.js';
import { memoryCache } from '../utils/cache.js';
import { redis } from '../database/redis.js';
import { logger } from '../logger.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { MoneyMath } from '../../shared/formatters.js';
import { getCurrencyInfo, SUPPORTED_CURRENCIES } from '../../shared/currencies.js';
import type { CurrencyConversionResult } from '../../shared/types.js';
import { config } from '../../config/environment.js';

export interface IExchangeRateProvider {
  name: string;
  fetchRate(baseCurrency: string, targetCurrency: string): Promise<number>;
  fetchLatestRates(baseCurrency: string): Promise<Record<string, number>>;
}

// Built-in benchmark fallback rates (USD base) used when external networks/providers are inaccessible
const DEFAULT_MARKET_RATES: Record<string, number> = {
  USD: 1.0,
  NGN: 1450.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  JPY: 154.5,
  AUD: 1.52,
  GHS: 14.8,
  KES: 130.5,
  ZAR: 18.2,
  AED: 3.67,
  INR: 83.4,
  CNY: 7.24,
  BRL: 5.45,
};

/**
 * Production Live FX Provider:
 * Fetches real-time exchange rates from configured FX providers or open market rate APIs.
 */
export class LiveExchangeRateProvider implements IExchangeRateProvider {
  public name = 'StockoraLiveExchangeRateProvider';

  /**
   * Fetches the complete exchange rate table with USD as canonical base.
   */
  public async fetchCanonicalRates(): Promise<Record<string, number>> {
    const cacheKey = 'fx:canonical_rates:usd';
    const cached = memoryCache.get<Record<string, number>>(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return cached;
    }

    const rates: Record<string, number> = { ...DEFAULT_MARKET_RATES };

    try {
      // 1. If OpenExchangeRates configured with key
      if (config.exchangeRateProvider === 'openexchangerates' && config.exchangeRateApiKey) {
        const res = await fetch(
          `https://openexchangerates.org/api/latest.json?app_id=${config.exchangeRateApiKey}&base=USD`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const data = (await res.json()) as { rates?: Record<string, number> };
          if (data && data.rates) {
            Object.assign(rates, data.rates);
            memoryCache.set(cacheKey, rates, 30 * 60 * 1000); // 30m TTL
            return rates;
          }
        }
      }

      // 2. Open Exchange Rate API (free public live open endpoint)
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = (await res.json()) as { rates?: Record<string, number>; result?: string };
        if (data && data.rates && typeof data.rates === 'object') {
          for (const [code, r] of Object.entries(data.rates)) {
            if (typeof r === 'number' && r > 0 && isFinite(r)) {
              rates[code.toUpperCase()] = r;
            }
          }
          memoryCache.set(cacheKey, rates, 30 * 60 * 1000); // 30m TTL
          return rates;
        }
      }
    } catch (err) {
      logger.warn(
        '[LiveExchangeRateProvider] Live FX network fetch failed, using fallback rates:',
        err
      );
      memoryCache.set(cacheKey, rates, 5 * 60 * 1000); // 5m fallback cache
    }

    // Return current composite rates
    return rates;
  }

  public async fetchRate(baseCurrency: string, targetCurrency: string): Promise<number> {
    const base = baseCurrency.toUpperCase().trim();
    const target = targetCurrency.toUpperCase().trim();
    if (base === target) return 1.0;

    const rates = await this.fetchCanonicalRates();
    const baseToUSD = rates[base] || DEFAULT_MARKET_RATES[base] || 1.0;
    const targetToUSD = rates[target] || DEFAULT_MARKET_RATES[target] || 1.0;

    if (baseToUSD <= 0 || targetToUSD <= 0) {
      throw new Error(`Invalid exchange rate data encountered for ${base}->${target}`);
    }

    // 1 base = (targetToUSD / baseToUSD) target
    return targetToUSD / baseToUSD;
  }

  public async fetchLatestRates(baseCurrency: string): Promise<Record<string, number>> {
    const base = baseCurrency.toUpperCase().trim();
    const rates = await this.fetchCanonicalRates();
    const baseToUSD = rates[base] || DEFAULT_MARKET_RATES[base] || 1.0;
    const results: Record<string, number> = {};

    // Map all supported currencies relative to target base currency
    for (const curr of Object.keys(SUPPORTED_CURRENCIES)) {
      const targetToUSD = rates[curr] || DEFAULT_MARKET_RATES[curr] || 1.0;
      results[curr] = targetToUSD / baseToUSD;
    }

    return results;
  }
}

export class DefaultExchangeRateProvider extends LiveExchangeRateProvider {}

export class ExchangeRateService {
  private static provider: IExchangeRateProvider = new LiveExchangeRateProvider();
  private static CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  public static setProvider(newProvider: IExchangeRateProvider) {
    this.provider = newProvider;
  }

  public static getProvider(): IExchangeRateProvider {
    return this.provider;
  }

  /**
   * Validates a numeric rate
   */
  public static validateRate(rate: number): void {
    if (typeof rate !== 'number' || isNaN(rate) || !isFinite(rate) || rate <= 0) {
      throw new Error(`Exchange rate must be a valid positive finite number. Received: ${rate}`);
    }
  }

  /**
   * Retrieves effective exchange rate between two currencies for a specific tenant.
   * Checks:
   * 1. Tenant Custom Override in DB
   * 2. Redis/Memory Cache
   * 3. Database stored rates
   * 4. External Provider with Resilient Execution
   */
  public static async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    tenantId?: string
  ): Promise<{ rate: number; provider: string; fetchedAt: Date; isStale: boolean }> {
    const from = fromCurrency.toUpperCase().trim();
    const to = toCurrency.toUpperCase().trim();

    if (!from || !to) {
      throw new Error('Both source and target currency codes are required.');
    }

    if (from === to) {
      return { rate: 1.0, provider: 'Identity', fetchedAt: new Date(), isStale: false };
    }

    const cacheKey = `exchange_rate:${tenantId || 'global'}:${from}:${to}`;

    // 1. Check in-memory cache
    const cached = memoryCache.get<{ rate: number; provider: string; fetchedAt: string }>(cacheKey);
    if (cached) {
      const fetchedDate = new Date(cached.fetchedAt);
      const isStale = Date.now() - fetchedDate.getTime() > 24 * 60 * 60 * 1000;
      return { rate: cached.rate, provider: cached.provider, fetchedAt: fetchedDate, isStale };
    }

    // 2. Check Redis cache
    if (redis && redis.status === 'ready') {
      try {
        const redisVal = await redis.get(cacheKey);
        if (redisVal) {
          const parsed = JSON.parse(redisVal);
          const fetchedDate = new Date(parsed.fetchedAt);
          const isStale = Date.now() - fetchedDate.getTime() > 24 * 60 * 60 * 1000;
          memoryCache.set(cacheKey, parsed, 5 * 60 * 1000);
          return { rate: parsed.rate, provider: parsed.provider, fetchedAt: fetchedDate, isStale };
        }
      } catch (err) {
        logger.warn(
          '[ExchangeRateService] Redis cache lookup failed, falling back to DB/Provider:',
          err
        );
      }
    }

    // 3. Check Tenant Custom Override in DB
    if (tenantId) {
      const customRate = await ExchangeRate.findOne({
        tenantId,
        baseCurrency: from,
        code: to,
        isActive: true,
      }).lean<IExchangeRate>();

      if (customRate && customRate.rate > 0) {
        const result = {
          rate: customRate.rate,
          provider: customRate.provider || 'TenantCustomOverride',
          fetchedAt: customRate.fetchedAt || new Date(),
          isStale: false,
        };
        memoryCache.set(
          cacheKey,
          { ...result, fetchedAt: result.fetchedAt.toISOString() },
          this.CACHE_TTL_MS
        );
        return result;
      }
    }

    // 4. Fetch via Provider with Resilient Execution
    let calculatedRate = 1.0;
    let providerName = this.provider.name;

    try {
      calculatedRate = await ResilientExecutor.execute(
        {
          name: 'ExchangeRateProvider',
          retryCount: 2,
          baseDelayMs: 200,
          maxDelayMs: 1000,
          backoffType: 'EXPONENTIAL',
          jitterType: 'FULL',
          isIdempotent: true,
        },
        async () => {
          return await this.provider.fetchRate(from, to);
        }
      );
    } catch (err) {
      logger.error(
        `[ExchangeRateService] Provider lookup failed for ${from}->${to}, using benchmark rate:`,
        err
      );
      calculatedRate = await new DefaultExchangeRateProvider().fetchRate(from, to);
      providerName = 'StockoraFallbackBenchmark';
    }

    // Validate rate
    this.validateRate(calculatedRate);

    const fetchedAt = new Date();
    const rateData = {
      rate: calculatedRate,
      provider: providerName,
      fetchedAt,
      isStale: false,
    };

    // Cache locally & in Redis
    memoryCache.set(
      cacheKey,
      { ...rateData, fetchedAt: fetchedAt.toISOString() },
      this.CACHE_TTL_MS
    );
    if (redis && redis.status === 'ready') {
      try {
        await redis.setex(
          cacheKey,
          Math.floor(this.CACHE_TTL_MS / 1000),
          JSON.stringify({
            ...rateData,
            fetchedAt: fetchedAt.toISOString(),
          })
        );
      } catch (err) {
        logger.warn('[ExchangeRateService] Failed to set Redis cache:', err);
      }
    }

    return rateData;
  }

  /**
   * Converts a financial amount from one currency to another using the authoritative rate.
   */
  public static async convertCurrency(params: {
    amount: number;
    fromCurrency: string;
    toCurrency: string;
    tenantId?: string;
  }): Promise<CurrencyConversionResult> {
    const { amount, fromCurrency, toCurrency, tenantId } = params;

    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      throw new Error(`Amount must be a valid finite number. Received: ${amount}`);
    }

    const { rate, provider, fetchedAt } = await this.getExchangeRate(
      fromCurrency,
      toCurrency,
      tenantId
    );
    const toInfo = getCurrencyInfo(toCurrency);
    const convertedAmount = MoneyMath.round(amount * rate, toInfo.decimalDigits);

    return {
      fromCurrency: fromCurrency.toUpperCase().trim(),
      toCurrency: toCurrency.toUpperCase().trim(),
      originalAmount: amount,
      convertedAmount,
      exchangeRate: rate,
      rateTimestamp: fetchedAt,
      provider,
    };
  }

  /**
   * Sets or overrides a custom exchange rate for a tenant.
   */
  public static async setCustomRate(params: {
    tenantId: string;
    baseCurrency: string;
    targetCurrency: string;
    rate: number;
    provider?: string;
  }) {
    const { tenantId, baseCurrency, targetCurrency, rate, provider = 'ManualAdmin' } = params;
    this.validateRate(rate);

    const base = baseCurrency.toUpperCase().trim();
    const target = targetCurrency.toUpperCase().trim();
    const currInfo = getCurrencyInfo(target);

    let doc = null;
    try {
      doc = await ExchangeRate.findOneAndUpdate(
        { tenantId, baseCurrency: base, code: target },
        {
          $set: {
            symbol: currInfo.symbol,
            rate,
            provider,
            fetchedAt: new Date(),
            isCustomOverride: true,
            isActive: true,
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.warn(
        '[ExchangeRateService] DB update failed for custom rate, proceeding with in-memory cache:',
        err
      );
    }

    // Set updated rate in caches
    const cacheKey = `exchange_rate:${tenantId}:${base}:${target}`;
    const fetchedAt = new Date();
    const rateData = {
      rate,
      provider,
      fetchedAt,
      isStale: false,
    };

    memoryCache.set(
      cacheKey,
      { ...rateData, fetchedAt: fetchedAt.toISOString() },
      this.CACHE_TTL_MS
    );
    if (redis && redis.status === 'ready') {
      try {
        await redis.setex(
          cacheKey,
          Math.floor(this.CACHE_TTL_MS / 1000),
          JSON.stringify({
            ...rateData,
            fetchedAt: fetchedAt.toISOString(),
          })
        );
      } catch (err) {
        logger.warn('[ExchangeRateService] Failed to set Redis cache for custom rate:', err);
      }
    }

    return doc;
  }

  /**
   * Lists all available exchange rates for a base currency.
   */
  public static async getLatestRates(baseCurrency = 'USD', tenantId?: string) {
    const base = baseCurrency.toUpperCase().trim();
    const rates = await this.provider.fetchLatestRates(base);

    // Merge tenant custom overrides
    if (tenantId) {
      const overrides = await ExchangeRate.find({
        tenantId,
        baseCurrency: base,
        isActive: true,
      }).lean();

      for (const ov of overrides) {
        rates[ov.code] = ov.rate;
      }
    }

    return rates;
  }
}
