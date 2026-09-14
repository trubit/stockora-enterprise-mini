/**
 * Centralized ISO 4217 Currency Definitions & Metadata
 */
export interface ICurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  symbolNative: string;
  decimalDigits: number;
  rounding: number;
  namePlural: string;
  flag: string;
  defaultLocale: string;
  isPopular?: boolean;
}

export const SUPPORTED_CURRENCIES: Record<string, ICurrencyInfo> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'US dollars',
    flag: '🇺🇸',
    defaultLocale: 'en-US',
    isPopular: true,
  },
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    symbolNative: '₦',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Nigerian nairas',
    flag: '🇳🇬',
    defaultLocale: 'en-NG',
    isPopular: true,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    symbolNative: '€',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'euros',
    flag: '🇪🇺',
    defaultLocale: 'de-DE',
    isPopular: true,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    symbolNative: '£',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'British pounds',
    flag: '🇬🇧',
    defaultLocale: 'en-GB',
    isPopular: true,
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Canadian dollars',
    flag: '🇨🇦',
    defaultLocale: 'en-CA',
    isPopular: true,
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    symbolNative: '￥',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Japanese yen',
    flag: '🇯🇵',
    defaultLocale: 'ja-JP',
    isPopular: true,
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'AU$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Australian dollars',
    flag: '🇦🇺',
    defaultLocale: 'en-AU',
  },
  GHS: {
    code: 'GHS',
    name: 'Ghanaian Cedi',
    symbol: 'GH₵',
    symbolNative: 'GH₵',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Ghanaian cedis',
    flag: '🇬🇭',
    defaultLocale: 'en-GH',
  },
  KES: {
    code: 'KES',
    name: 'Kenyan Shilling',
    symbol: 'KSh',
    symbolNative: 'KSh',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Kenyan shillings',
    flag: '🇰🇪',
    defaultLocale: 'en-KE',
  },
  ZAR: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R',
    symbolNative: 'R',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'South African rand',
    flag: '🇿🇦',
    defaultLocale: 'en-ZA',
  },
  AED: {
    code: 'AED',
    name: 'United Arab Emirates Dirham',
    symbol: 'AED',
    symbolNative: 'د.إ',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'UAE dirhams',
    flag: '🇦🇪',
    defaultLocale: 'ar-AE',
  },
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    symbolNative: '₹',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Indian rupees',
    flag: '🇮🇳',
    defaultLocale: 'en-IN',
  },
  CNY: {
    code: 'CNY',
    name: 'Chinese Yuan',
    symbol: 'CN¥',
    symbolNative: '¥',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Chinese yuan',
    flag: '🇨🇳',
    defaultLocale: 'zh-CN',
  },
  BRL: {
    code: 'BRL',
    name: 'Brazilian Real',
    symbol: 'R$',
    symbolNative: 'R$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Brazilian reals',
    flag: '🇧🇷',
    defaultLocale: 'pt-BR',
  },
};

export const DEFAULT_CURRENCY_CODE = 'USD';

export function getCurrencyInfo(code?: string): ICurrencyInfo {
  const normalized = (code || DEFAULT_CURRENCY_CODE).toUpperCase().trim();
  return (
    SUPPORTED_CURRENCIES[normalized] || {
      code: normalized,
      name: normalized,
      symbol: normalized,
      symbolNative: normalized,
      decimalDigits: 2,
      rounding: 0,
      namePlural: normalized,
      flag: '🌐',
      defaultLocale: 'en-US',
    }
  );
}
