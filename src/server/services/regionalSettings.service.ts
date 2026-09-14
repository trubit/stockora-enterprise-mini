import mongoose from 'mongoose';
import { RegionalSettings, type IRegionalSettings } from '../models/RegionalSettings.js';
import { Tenant, type ITenant } from '../models/Tenant.js';
import { Company } from '../models/Company.js';
import { AuditLog } from '../models/AuditLog.js';
import { memoryCache } from '../utils/cache.js';
import { redis } from '../database/redis.js';
import { logger } from '../logger.js';
import { getCountryInfo, SUPPORTED_TIMEZONES } from '../../shared/countries.js';
import { getCurrencyInfo, SUPPORTED_CURRENCIES } from '../../shared/currencies.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';

export class RegionalSettingsService {
  private static CACHE_TTL_MS = 30 * 60 * 1000; // 30 mins

  /**
   * Retrieves regional settings for a tenant, initializing defaults if necessary.
   */
  public static async getSettings(tenantId: string): Promise<IRegionalSettings> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required.');
    }

    const cacheKey = `tenant:regional:${tenantId}`;
    const cached = memoryCache.get<IRegionalSettings>(cacheKey);
    if (cached) return cached;

    if (redis && redis.status === 'ready') {
      try {
        const raw = await redis.get(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          memoryCache.set(cacheKey, parsed, 5 * 60 * 1000);
          return parsed;
        }
      } catch (err) {
        logger.warn('[RegionalSettingsService] Redis cache lookup failed:', err);
      }
    }

    const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId)
      ? new mongoose.Types.ObjectId(tenantId)
      : tenantId;

    let doc = await RegionalSettings.findOne({ tenantId: tenantObjId });

    if (doc) {
      // Normalize legacy malformed countryCode fields (e.g. 'UNITED KINGDOM' -> 'GB')
      if (doc.countryCode && (doc.countryCode.length > 3 || doc.countryCode.includes(' '))) {
        const countryInfo = getCountryInfo(doc.countryCode || doc.country);
        doc.countryCode = countryInfo.code;
        doc.country = countryInfo.name;
        await RegionalSettings.updateOne(
          { _id: doc._id },
          { $set: { countryCode: countryInfo.code, country: countryInfo.name } }
        );
      }
    } else {
      // Initialize from Tenant record or default Country configuration
      const tenant = await Tenant.findById(tenantId).lean<ITenant>();
      const rawCountry = tenant?.contact?.country || 'US';
      const countryInfo = getCountryInfo(rawCountry);
      const baseCurrency = tenant?.fiscalConfig?.currency || countryInfo.defaultCurrency;
      const currInfo = getCurrencyInfo(baseCurrency);

      doc = await RegionalSettings.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        country: countryInfo.name,
        countryCode: countryInfo.code,
        currency: currInfo.code,
        currencySymbol: currInfo.symbol,
        supportedCurrencies: Array.from(new Set([currInfo.code, 'USD', 'NGN', 'EUR', 'GBP'])),
        timezone: tenant?.fiscalConfig?.timezone || countryInfo.defaultTimezone,
        language: tenant?.fiscalConfig?.locale?.split('-')[0] || 'en',
        dateFormat: tenant?.fiscalConfig?.dateFormat || 'YYYY-MM-DD',
        timeFormat: '12h',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          precision: currInfo.decimalDigits,
        },
        firstDayOfWeek: 'Monday',
        measurementSystem: 'Metric',
        taxConfig: {
          taxId: tenant?.taxConfig?.taxId || '',
          taxRegistrationName: tenant?.taxConfig?.taxRegistrationName || countryInfo.defaultTaxType,
          taxType: countryInfo.defaultTaxType,
          defaultTaxRate: tenant?.taxConfig?.defaultTaxRate ?? countryInfo.defaultTaxRate,
          isTaxInclusive: tenant?.taxConfig?.isTaxInclusive ?? false,
          taxExemptionAllowed: tenant?.taxConfig?.taxExemptionAllowed ?? true,
          taxRates: [
            {
              name: 'Standard Rate',
              code: 'STANDARD',
              ratePercentage: tenant?.taxConfig?.defaultTaxRate ?? countryInfo.defaultTaxRate,
              type: countryInfo.defaultTaxType,
              category: 'STANDARD',
              isInclusive: tenant?.taxConfig?.isTaxInclusive ?? false,
              isActive: true,
            },
            {
              name: 'Zero-Rated Essentials',
              code: 'ZERO_RATED',
              ratePercentage: 0,
              type: countryInfo.defaultTaxType,
              category: 'ZERO_RATED',
              isInclusive: false,
              isActive: true,
            },
          ],
        },
      });
    }

    memoryCache.set(cacheKey, doc, this.CACHE_TTL_MS);
    if (redis && redis.status === 'ready') {
      try {
        await redis.setex(cacheKey, Math.floor(this.CACHE_TTL_MS / 1000), JSON.stringify(doc));
      } catch (err) {
        logger.warn('[RegionalSettingsService] Failed to cache in Redis:', err);
      }
    }

    return doc;
  }

  /**
   * Updates regional settings for a tenant with strict schema validation and cache invalidation.
   */
  public static async updateSettings(
    tenantId: string,
    payload: Partial<IRegionalSettings>,
    userId?: string
  ): Promise<IRegionalSettings> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required.');
    }

    const currentDoc = await this.getSettings(tenantId);
    const prevValues = currentDoc.toObject ? currentDoc.toObject() : currentDoc;

    // 1. Validation
    if (payload.currency) {
      const code = payload.currency.toUpperCase().trim();
      if (!SUPPORTED_CURRENCIES[code]) {
        throw new ValidationError(`Unsupported currency code [${code}].`);
      }
      payload.currency = code;
      payload.currencySymbol = getCurrencyInfo(code).symbol;
    }

    if (payload.countryCode || payload.country) {
      const countryInfo = getCountryInfo(payload.countryCode || payload.country);
      payload.country = countryInfo.name;
      payload.countryCode = countryInfo.code;
    }

    if (payload.timezone && !SUPPORTED_TIMEZONES.includes(payload.timezone)) {
      throw new ValidationError(`Invalid timezone specified: ${payload.timezone}`);
    }

    if (payload.taxConfig) {
      if (
        payload.taxConfig.defaultTaxRate !== undefined &&
        (payload.taxConfig.defaultTaxRate < 0 || payload.taxConfig.defaultTaxRate > 100)
      ) {
        throw new ValidationError('Default tax rate must be between 0 and 100.');
      }
    }

    // 2. Perform Atomic Update
    const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId)
      ? new mongoose.Types.ObjectId(tenantId)
      : tenantId;

    const updatedDoc = await RegionalSettings.findOneAndUpdate(
      { $or: [{ _id: currentDoc._id }, { tenantId: tenantObjId }] },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!updatedDoc) {
      throw new NotFoundError('Regional settings record not found.');
    }

    const rawLang = (updatedDoc.language || 'en').toLowerCase().trim();
    const langSubtag = rawLang.length === 2 ? rawLang : 'en';
    const countrySubtag =
      updatedDoc.countryCode && updatedDoc.countryCode.length === 2 ? updatedDoc.countryCode : 'US';
    const computedLocale = `${langSubtag}-${countrySubtag}`;

    // 3. Sync to Tenant and Company records for backward compatibility
    await Tenant.findByIdAndUpdate(tenantId, {
      $set: {
        'fiscalConfig.currency': updatedDoc.currency,
        'fiscalConfig.currencySymbol': updatedDoc.currencySymbol,
        'fiscalConfig.timezone': updatedDoc.timezone,
        'fiscalConfig.locale': computedLocale,
        'fiscalConfig.dateFormat': updatedDoc.dateFormat,
        'taxConfig.taxId': updatedDoc.taxConfig.taxId,
        'taxConfig.taxRegistrationName': updatedDoc.taxConfig.taxRegistrationName,
        'taxConfig.defaultTaxRate': updatedDoc.taxConfig.defaultTaxRate,
        'taxConfig.isTaxInclusive': updatedDoc.taxConfig.isTaxInclusive,
      },
    });

    await Company.updateMany(
      { tenantId },
      {
        $set: {
          currency: updatedDoc.currency,
          timeZone: updatedDoc.timezone,
          locale: `${updatedDoc.language}-${updatedDoc.countryCode}`,
          taxId: updatedDoc.taxConfig.taxId,
        },
      }
    );

    // 4. Invalidate Caches
    const cacheKey = `tenant:regional:${tenantId}`;
    memoryCache.delete(cacheKey);
    if (redis && redis.status === 'ready') {
      try {
        await redis.del(cacheKey);
      } catch (err) {
        logger.warn('[RegionalSettingsService] Failed to invalidate Redis cache:', err);
      }
    }

    // 5. Audit Trail
    await AuditLog.create({
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      action: 'UPDATE_REGIONAL_SETTINGS',
      targetModel: 'RegionalSettings',
      targetId: updatedDoc._id.toString(),
      previousValues: prevValues,
      newValues: updatedDoc.toObject(),
    });

    logger.info(`[RegionalSettingsService] Updated regional settings for tenant ${tenantId}`);
    return updatedDoc;
  }
}
