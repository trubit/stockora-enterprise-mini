/**
 * Centralized ISO 3166-1 Country Registry & Regional Defaults
 */
export interface ICountryInfo {
  code: string; // ISO 2-letter
  name: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultLocale: string;
  defaultTaxType: 'VAT' | 'SALES_TAX' | 'GST' | 'EXEMPT';
  defaultTaxRate: number;
  flag: string;
  dialCode: string;
  supportedLanguages: string[];
}

export const SUPPORTED_COUNTRIES: ICountryInfo[] = [
  {
    code: 'US',
    name: 'United States',
    defaultCurrency: 'USD',
    defaultTimezone: 'America/New_York',
    defaultLocale: 'en-US',
    defaultTaxType: 'SALES_TAX',
    defaultTaxRate: 8.0,
    flag: '🇺🇸',
    dialCode: '+1',
    supportedLanguages: ['en', 'es'],
  },
  {
    code: 'NG',
    name: 'Nigeria',
    defaultCurrency: 'NGN',
    defaultTimezone: 'Africa/Lagos',
    defaultLocale: 'en-NG',
    defaultTaxType: 'VAT',
    defaultTaxRate: 7.5,
    flag: '🇳🇬',
    dialCode: '+234',
    supportedLanguages: ['en', 'yo', 'ha', 'ig'],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    defaultCurrency: 'GBP',
    defaultTimezone: 'Europe/London',
    defaultLocale: 'en-GB',
    defaultTaxType: 'VAT',
    defaultTaxRate: 20.0,
    flag: '🇬🇧',
    dialCode: '+44',
    supportedLanguages: ['en'],
  },
  {
    code: 'DE',
    name: 'Germany',
    defaultCurrency: 'EUR',
    defaultTimezone: 'Europe/Berlin',
    defaultLocale: 'de-DE',
    defaultTaxType: 'VAT',
    defaultTaxRate: 19.0,
    flag: '🇩🇪',
    dialCode: '+49',
    supportedLanguages: ['de', 'en'],
  },
  {
    code: 'FR',
    name: 'France',
    defaultCurrency: 'EUR',
    defaultTimezone: 'Europe/Paris',
    defaultLocale: 'fr-FR',
    defaultTaxType: 'VAT',
    defaultTaxRate: 20.0,
    flag: '🇫🇷',
    dialCode: '+33',
    supportedLanguages: ['fr', 'en'],
  },
  {
    code: 'CA',
    name: 'Canada',
    defaultCurrency: 'CAD',
    defaultTimezone: 'America/Toronto',
    defaultLocale: 'en-CA',
    defaultTaxType: 'GST',
    defaultTaxRate: 13.0,
    flag: '🇨🇦',
    dialCode: '+1',
    supportedLanguages: ['en', 'fr'],
  },
  {
    code: 'JP',
    name: 'Japan',
    defaultCurrency: 'JPY',
    defaultTimezone: 'Asia/Tokyo',
    defaultLocale: 'ja-JP',
    defaultTaxType: 'VAT',
    defaultTaxRate: 10.0,
    flag: '🇯🇵',
    dialCode: '+81',
    supportedLanguages: ['ja', 'en'],
  },
  {
    code: 'GH',
    name: 'Ghana',
    defaultCurrency: 'GHS',
    defaultTimezone: 'Africa/Accra',
    defaultLocale: 'en-GH',
    defaultTaxType: 'VAT',
    defaultTaxRate: 15.0,
    flag: '🇬🇭',
    dialCode: '+233',
    supportedLanguages: ['en'],
  },
  {
    code: 'KE',
    name: 'Kenya',
    defaultCurrency: 'KES',
    defaultTimezone: 'Africa/Nairobi',
    defaultLocale: 'en-KE',
    defaultTaxType: 'VAT',
    defaultTaxRate: 16.0,
    flag: '🇰🇪',
    dialCode: '+254',
    supportedLanguages: ['en', 'sw'],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    defaultCurrency: 'ZAR',
    defaultTimezone: 'Africa/Johannesburg',
    defaultLocale: 'en-ZA',
    defaultTaxType: 'VAT',
    defaultTaxRate: 15.0,
    flag: '🇿🇦',
    dialCode: '+27',
    supportedLanguages: ['en', 'af'],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    defaultCurrency: 'AED',
    defaultTimezone: 'Asia/Dubai',
    defaultLocale: 'ar-AE',
    defaultTaxType: 'VAT',
    defaultTaxRate: 5.0,
    flag: '🇦🇪',
    dialCode: '+971',
    supportedLanguages: ['ar', 'en'],
  },
  {
    code: 'IN',
    name: 'India',
    defaultCurrency: 'INR',
    defaultTimezone: 'Asia/Kolkata',
    defaultLocale: 'en-IN',
    defaultTaxType: 'GST',
    defaultTaxRate: 18.0,
    flag: '🇮🇳',
    dialCode: '+91',
    supportedLanguages: ['en', 'hi'],
  },
  {
    code: 'CN',
    name: 'China',
    defaultCurrency: 'CNY',
    defaultTimezone: 'Asia/Shanghai',
    defaultLocale: 'zh-CN',
    defaultTaxType: 'VAT',
    defaultTaxRate: 13.0,
    flag: '🇨🇳',
    dialCode: '+86',
    supportedLanguages: ['zh', 'en'],
  },
  {
    code: 'BR',
    name: 'Brazil',
    defaultCurrency: 'BRL',
    defaultTimezone: 'America/Sao_Paulo',
    defaultLocale: 'pt-BR',
    defaultTaxType: 'VAT',
    defaultTaxRate: 17.0,
    flag: '🇧🇷',
    dialCode: '+55',
    supportedLanguages: ['pt', 'en'],
  },
];

export const SUPPORTED_TIMEZONES = [
  'UTC',
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Nairobi',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const COUNTRY_ALIASES: Record<string, string> = {
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
  ENGLAND: 'GB',
  USA: 'US',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  NIGERIA: 'NG',
  GERMANY: 'DE',
  DEUTSCHLAND: 'DE',
  FRANCE: 'FR',
  CANADA: 'CA',
  JAPAN: 'JP',
  GHANA: 'GH',
  KENYA: 'KE',
  'SOUTH AFRICA': 'ZA',
  UAE: 'AE',
  'UNITED ARAB EMIRATES': 'AE',
  INDIA: 'IN',
  CHINA: 'CN',
  BRAZIL: 'BR',
};

export function getCountryInfo(codeOrName?: string): ICountryInfo {
  if (!codeOrName) {
    return SUPPORTED_COUNTRIES[0]; // Default US
  }

  const raw = String(codeOrName).trim();
  const upper = raw.toUpperCase();

  // 1. Direct ISO 2-letter code match
  const byCode = SUPPORTED_COUNTRIES.find((c) => c.code.toUpperCase() === upper);
  if (byCode) return byCode;

  // 2. Direct Country Name match
  const byName = SUPPORTED_COUNTRIES.find((c) => c.name.toUpperCase() === upper);
  if (byName) return byName;

  // 3. Known country alias lookup (e.g. 'United Kingdom' -> 'GB', 'USA' -> 'US')
  if (COUNTRY_ALIASES[upper]) {
    const aliasCode = COUNTRY_ALIASES[upper];
    const byAlias = SUPPORTED_COUNTRIES.find((c) => c.code === aliasCode);
    if (byAlias) return byAlias;
  }

  // 4. Case-insensitive partial name match
  const byPartial = SUPPORTED_COUNTRIES.find(
    (c) =>
      c.name.toLowerCase().includes(raw.toLowerCase()) ||
      raw.toLowerCase().includes(c.name.toLowerCase())
  );
  if (byPartial) return byPartial;

  // 5. Fallback for valid 2-letter codes or generic default
  const fallbackCode = upper.length === 2 ? upper : 'US';
  return {
    code: fallbackCode,
    name: raw,
    defaultCurrency: 'USD',
    defaultTimezone: 'UTC',
    defaultLocale: `en-${fallbackCode}`,
    defaultTaxType: 'VAT',
    defaultTaxRate: 0,
    flag: '🌐',
    dialCode: '+1',
    supportedLanguages: ['en'],
  };
}
