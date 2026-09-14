import { getCurrencyInfo } from './currencies.js';
import { getCountryInfo } from './countries.js';

export interface FormatCurrencyOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  displaySymbol?: boolean;
}

/**
 * Validates and normalizes any locale string to a valid BCP 47 language tag.
 * Repairs common malformed inputs such as 'en-UNITED KINGDOM' -> 'en-GB', 'en_US' -> 'en-US',
 * and guarantees that a valid language tag is returned that will not crash Intl APIs.
 */
export function normalizeLocale(locale?: string | null, fallback = 'en-US'): string {
  if (!locale || typeof locale !== 'string') {
    return fallback;
  }

  const trimmed = locale.trim();
  if (!trimmed) {
    return fallback;
  }

  // Normalize underscore to hyphen
  const normalizedTag = trimmed.replace(/_/g, '-');
  const parts = normalizedTag.split('-');

  // 1. If standard language only (e.g. 'en', 'fr', 'es')
  if (parts.length === 1) {
    if (parts[0].length === 2 || parts[0].length === 3) {
      const lang = parts[0].toLowerCase();
      try {
        new Intl.NumberFormat(lang);
        return lang;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  // 2. If standard language + 2-letter ISO region (e.g. 'en-US', 'en-GB', 'en-NG')
  if (
    parts.length === 2 &&
    (parts[0].length === 2 || parts[0].length === 3) &&
    parts[1].length === 2
  ) {
    const lang = parts[0].toLowerCase();
    const region = parts[1].toUpperCase();
    const candidate = `${lang}-${region}`;
    try {
      new Intl.NumberFormat(candidate);
      return candidate;
    } catch {
      return fallback;
    }
  }

  // 3. Repair composite tags with full country names (e.g. 'en-UNITED KINGDOM', 'en-Nigeria', 'en-United States')
  if (parts.length >= 2) {
    const rawLang = parts[0].toLowerCase();
    const safeLang = rawLang.length === 2 ? rawLang : 'en';
    const regionPart = parts.slice(1).join(' ').trim();
    const countryInfo = getCountryInfo(regionPart);

    if (countryInfo && countryInfo.code && countryInfo.code.length === 2) {
      const candidate = `${safeLang}-${countryInfo.code}`;
      try {
        new Intl.NumberFormat(candidate);
        return candidate;
      } catch {
        return fallback;
      }
    }

    if (parts[0].length === 2) {
      return parts[0].toLowerCase();
    }
  }

  // 4. Fallback for invalid tags
  return fallback;
}

/**
 * Format monetary amount with appropriate locale, symbol, and precision.
 * Guarantees resilient formatting without throwing RangeError.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currencyCode = 'USD',
  options: FormatCurrencyOptions = {}
): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const curr = getCurrencyInfo(currencyCode);
  const targetLocale = options.locale || curr.defaultLocale || 'en-US';
  const safeLocale = normalizeLocale(targetLocale, curr.defaultLocale || 'en-US');
  const minDigits =
    options.minimumFractionDigits !== undefined
      ? options.minimumFractionDigits
      : curr.decimalDigits;
  const maxDigits =
    options.maximumFractionDigits !== undefined
      ? options.maximumFractionDigits
      : curr.decimalDigits;

  try {
    const formatter = new Intl.NumberFormat(safeLocale, {
      style: 'currency',
      currency: curr.code,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    });
    return formatter.format(num);
  } catch {
    // Deterministic fallback: format number with standard en-US locale and prefix currency symbol
    try {
      const formattedNum = num.toLocaleString('en-US', {
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
      });
      return `${curr.symbol}${formattedNum}`;
    } catch {
      return `${curr.symbol}${num.toFixed(minDigits)}`;
    }
  }
}

/**
 * Format general numbers with localized grouping/decimal separators.
 */
export function formatNumber(
  value: number | null | undefined,
  locale = 'en-US',
  options: Intl.NumberFormatOptions = {}
): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  const safeLocale = normalizeLocale(locale, 'en-US');
  try {
    return new Intl.NumberFormat(safeLocale, options).format(num);
  } catch {
    try {
      return num.toLocaleString('en-US', options);
    } catch {
      return String(num);
    }
  }
}

/**
 * Timezone-aware date formatter.
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  locale = 'en-US',
  timezone = 'UTC',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  const safeLocale = normalizeLocale(locale, 'en-US');

  try {
    return new Intl.DateTimeFormat(safeLocale, {
      ...options,
      timeZone: timezone,
    }).format(d);
  } catch {
    try {
      return new Intl.DateTimeFormat('en-US', {
        ...options,
        timeZone: 'UTC',
      }).format(d);
    } catch {
      return d.toISOString().split('T')[0];
    }
  }
}

/**
 * Timezone-aware time formatter.
 */
export function formatTime(
  date: Date | string | number | null | undefined,
  locale = 'en-US',
  timezone = 'UTC',
  timeFormat: '12h' | '24h' = '12h'
): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  const safeLocale = normalizeLocale(locale, 'en-US');
  const hour12 = timeFormat === '12h';
  try {
    return new Intl.DateTimeFormat(safeLocale, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12,
      timeZone: timezone,
    }).format(d);
  } catch {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12,
        timeZone: 'UTC',
      }).format(d);
    } catch {
      return d.toLocaleTimeString();
    }
  }
}

/**
 * Decimal-safe deterministic money calculations (cents/integers representation).
 */
export const MoneyMath = {
  toCents(amount: number, decimalDigits = 2): number {
    const factor = Math.pow(10, decimalDigits);
    return Math.round(amount * factor);
  },

  fromCents(cents: number, decimalDigits = 2): number {
    const factor = Math.pow(10, decimalDigits);
    return Math.round(cents) / factor;
  },

  add(a: number, b: number, decimalDigits = 2): number {
    const factor = Math.pow(10, decimalDigits);
    return (Math.round(a * factor) + Math.round(b * factor)) / factor;
  },

  subtract(a: number, b: number, decimalDigits = 2): number {
    const factor = Math.pow(10, decimalDigits);
    return (Math.round(a * factor) - Math.round(b * factor)) / factor;
  },

  multiply(amount: number, factor: number, decimalDigits = 2): number {
    const multFactor = Math.pow(10, decimalDigits);
    return Math.round(amount * factor * multFactor) / multFactor;
  },

  round(amount: number, decimalDigits = 2): number {
    const factor = Math.pow(10, decimalDigits);
    return Math.round(amount * factor) / factor;
  },
};
