import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatTime,
  normalizeLocale,
  MoneyMath,
} from '../../shared/formatters.js';
import { getCountryInfo } from '../../shared/countries.js';
import { getCurrencyInfo } from '../../shared/currencies.js';
import type { RegionalSettings } from '../../shared/types.js';
import { useCurrencyStore } from '../store/currency.js';
import { toast } from 'react-hot-toast';

export interface FormatAmountOptions {
  currency?: string;
  fromCurrency?: string;
  convert?: boolean;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

const BENCHMARK_USD_RATES: Record<string, number> = {
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

const DEFAULT_REGIONAL_SETTINGS: RegionalSettings = {
  country: 'Nigeria',
  countryCode: 'NG',
  currency: 'NGN',
  currencySymbol: '₦',
  supportedCurrencies: ['NGN', 'USD', 'EUR', 'GBP'],
  timezone: 'Africa/Lagos',
  language: 'en',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
  numberFormat: {
    decimalSeparator: '.',
    thousandSeparator: ',',
    precision: 2,
  },
  firstDayOfWeek: 'Monday',
  measurementSystem: 'Metric',
  taxConfig: {
    taxRegistrationName: 'Zero-Tax Exempt',
    taxType: 'EXEMPT',
    defaultTaxRate: 0,
    isTaxInclusive: false,
    taxExemptionAllowed: true,
  },
};

export function useRegionalSettings() {
  const queryClient = useQueryClient();
  const {
    displayCurrency: preferredCurrency,
    setDisplayCurrency,
    resetDisplayCurrency,
  } = useCurrencyStore();

  const {
    data: settings,
    isLoading: isSettingsLoading,
    error,
  } = useQuery<RegionalSettings>({
    queryKey: ['regional-settings'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<RegionalSettings>('/regional-settings', {
          _skipGlobalErrorToast: true,
        } as any);
        return data;
      } catch {
        return DEFAULT_REGIONAL_SETTINGS;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  const baseCurrency = settings?.currency || 'NGN';
  const activeCurrency = preferredCurrency || baseCurrency;

  // Query live exchange rates relative to the tenant's base currency
  const { data: exchangeRatesData, isLoading: isRatesLoading } = useQuery({
    queryKey: ['exchange-rates', baseCurrency],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{
          baseCurrency: string;
          rates: Record<string, number>;
          fetchedAt: string;
        }>(`/exchange-rates?base=${baseCurrency}`, {
          _skipGlobalErrorToast: true,
        } as any);
        return data;
      } catch {
        const baseToUsd = BENCHMARK_USD_RATES[baseCurrency] || 1.0;
        const normalizedFallbackRates: Record<string, number> = {};
        for (const [curr, r] of Object.entries(BENCHMARK_USD_RATES)) {
          normalizedFallbackRates[curr] = r / baseToUsd;
        }
        return {
          baseCurrency,
          rates: normalizedFallbackRates,
          fetchedAt: new Date().toISOString(),
        };
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
    enabled: Boolean(baseCurrency),
  });

  const rates = exchangeRatesData?.rates || {};

  const getRate = (code: string): number => {
    const upper = code.toUpperCase().trim();
    if (upper === baseCurrency) return 1.0;
    if (rates[upper] !== undefined && rates[upper] > 0) return rates[upper];
    const baseToUsd = BENCHMARK_USD_RATES[baseCurrency] || 1.0;
    const targetToUsd = BENCHMARK_USD_RATES[upper] || 1.0;
    return targetToUsd / baseToUsd;
  };

  const mutation = useMutation({
    mutationFn: async (payload: Partial<RegionalSettings>) => {
      const { data } = await apiClient.patch<RegionalSettings>('/regional-settings', payload);
      return data;
    },
    onSuccess: (newSettings) => {
      queryClient.setQueryData(['regional-settings'], newSettings);
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Regional settings updated successfully.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to update regional settings.');
    },
  });

  const currencySymbol = getCurrencyInfo(activeCurrency).symbol;
  const supportedCurrencies = settings?.supportedCurrencies || ['USD', 'NGN', 'EUR', 'GBP'];
  const timezone = settings?.timezone || 'UTC';

  // Safely resolve ISO 2-letter country code and BCP 47 compliant locale
  const countryInfo = getCountryInfo(settings?.countryCode || settings?.country);
  const countryCode = countryInfo.code;
  const rawLang = (settings?.language || 'en').toLowerCase().trim();
  const langSubtag = rawLang.length === 2 ? rawLang : 'en';
  const locale = normalizeLocale(
    `${langSubtag}-${countryCode}`,
    countryInfo.defaultLocale || 'en-US'
  );

  /**
   * Mathematically convert an amount between two currencies using the loaded exchange rates.
   */
  const convertAmount = (
    amount: number | null | undefined,
    fromCurrency = baseCurrency,
    toCurrency = activeCurrency
  ): number => {
    if (amount == null || isNaN(amount)) return 0;
    const from = fromCurrency.toUpperCase().trim();
    const to = toCurrency.toUpperCase().trim();

    if (from === to) return amount;

    const rateFrom = getRate(from);
    const rateTo = getRate(to);

    if (rateFrom <= 0) return amount;
    const effectiveRate = rateTo / rateFrom;

    const toInfo = getCurrencyInfo(to);
    return MoneyMath.round(amount * effectiveRate, toInfo.decimalDigits);
  };

  /**
   * Bound formatting helper.
   * If display conversion is active (activeCurrency !== baseCurrency) and convert is true (default),
   * automatically converts the value from base currency to display currency.
   */
  const formatAmount = (
    amount: number | null | undefined,
    options?: string | FormatAmountOptions
  ): string => {
    const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;

    if (typeof options === 'string') {
      const targetCurr = options.toUpperCase().trim();
      const shouldConvert = targetCurr !== baseCurrency;
      const finalAmount = shouldConvert ? convertAmount(num, baseCurrency, targetCurr) : num;
      const targetCurrInfo = getCurrencyInfo(targetCurr);
      const targetLocale =
        targetCurr === baseCurrency ? locale : targetCurrInfo.defaultLocale || locale;
      return formatCurrency(finalAmount, targetCurr, { locale: targetLocale });
    }

    const targetCurr = (options?.currency || activeCurrency).toUpperCase().trim();
    const sourceCurr = (options?.fromCurrency || baseCurrency).toUpperCase().trim();
    const shouldConvert = options?.convert !== false && targetCurr !== sourceCurr;

    const finalAmount = shouldConvert ? convertAmount(num, sourceCurr, targetCurr) : num;
    const targetCurrInfo = getCurrencyInfo(targetCurr);
    const targetLocale =
      options?.locale ||
      (targetCurr === baseCurrency ? locale : targetCurrInfo.defaultLocale || locale);

    return formatCurrency(finalAmount, targetCurr, {
      locale: targetLocale,
      minimumFractionDigits: options?.minimumFractionDigits,
      maximumFractionDigits: options?.maximumFractionDigits,
    });
  };

  const formatNum = (val: number | null | undefined) => {
    return formatNumber(val, locale);
  };

  const formatDateTime = (date: Date | string | number | null | undefined) => {
    return formatDate(date, locale, timezone);
  };

  const formatTimeOnly = (date: Date | string | number | null | undefined) => {
    return formatTime(date, locale, timezone, settings?.timeFormat || '12h');
  };

  return {
    settings,
    isLoading: isSettingsLoading || isRatesLoading,
    error,
    baseCurrency,
    activeCurrency,
    displayCurrency: activeCurrency,
    isConverted: activeCurrency !== baseCurrency,
    currencySymbol,
    supportedCurrencies,
    exchangeRates: rates,
    exchangeRatesData,
    timezone: settings?.timezone || 'UTC',
    taxConfig: {
      taxId: '',
      taxRegistrationName: 'Zero-Tax Exempt',
      taxType: 'EXEMPT' as const,
      defaultTaxRate: 0,
      isTaxInclusive: false,
      taxExemptionAllowed: true,
      taxRates: [],
    },
    convertAmount,
    formatAmount,
    formatNum,
    formatDateTime,
    formatTimeOnly,
    setDisplayCurrency,
    resetDisplayCurrency,
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
