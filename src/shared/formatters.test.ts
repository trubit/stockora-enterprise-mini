import { describe, it, expect } from 'vitest';
import {
  normalizeLocale,
  formatCurrency,
  formatNumber,
  formatDate,
  formatTime,
} from './formatters.js';

describe('formatters - Locale Normalization & Currency Formatting', () => {
  describe('normalizeLocale', () => {
    it('returns standard valid BCP 47 locales unchanged', () => {
      expect(normalizeLocale('en-US')).toBe('en-US');
      expect(normalizeLocale('en-GB')).toBe('en-GB');
      expect(normalizeLocale('en-NG')).toBe('en-NG');
      expect(normalizeLocale('fr-FR')).toBe('fr-FR');
      expect(normalizeLocale('de-DE')).toBe('de-DE');
    });

    it('normalizes malformed composite country name locales to valid ISO 3166-1 alpha-2 tags', () => {
      expect(normalizeLocale('en-UNITED KINGDOM')).toBe('en-GB');
      expect(normalizeLocale('en-United Kingdom')).toBe('en-GB');
      expect(normalizeLocale('en-Nigeria')).toBe('en-NG');
      expect(normalizeLocale('en-United States')).toBe('en-US');
    });

    it('normalizes underscore-separated locales', () => {
      expect(normalizeLocale('en_US')).toBe('en-US');
      expect(normalizeLocale('en_GB')).toBe('en-GB');
    });

    it('handles null, undefined, empty, and invalid strings gracefully with fallback', () => {
      expect(normalizeLocale(null)).toBe('en-US');
      expect(normalizeLocale(undefined)).toBe('en-US');
      expect(normalizeLocale('')).toBe('en-US');
      expect(normalizeLocale('   ')).toBe('en-US');
      expect(normalizeLocale('xyz-12345-invalid')).toBe('en-US');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD with standard en-US locale', () => {
      const result = formatCurrency(1234.56, 'USD', { locale: 'en-US' });
      expect(result).toMatch(/\$1,234\.56/);
    });

    it('formats GBP with en-GB locale', () => {
      const result = formatCurrency(1234.56, 'GBP', { locale: 'en-GB' });
      expect(result).toMatch(/£1,234\.56/);
    });

    it('formats NGN with en-NG locale', () => {
      const result = formatCurrency(500000, 'NGN', { locale: 'en-NG' });
      expect(result).toContain('500,000.00');
    });

    it('never throws RangeError when given malformed locale tag like en-UNITED KINGDOM', () => {
      expect(() => {
        const result = formatCurrency(250, 'GBP', { locale: 'en-UNITED KINGDOM' });
        expect(result).toMatch(/£250\.00/);
      }).not.toThrow();
    });

    it('automatically uses currency defaultLocale when locale is not explicitly provided', () => {
      expect(formatCurrency(100, 'USD')).toMatch(/\$100\.00/);
      expect(formatCurrency(100, 'GBP')).toMatch(/£100\.00/);
      expect(formatCurrency(100, 'EUR')).toContain('100');
      expect(formatCurrency(100, 'NGN')).toContain('100.00');
      expect(formatCurrency(100, 'JPY')).toMatch(/[¥￥]100/);
    });

    it('handles null, undefined, and NaN amounts safely', () => {
      expect(formatCurrency(null, 'USD')).toBe('$0.00');
      expect(formatCurrency(undefined, 'USD')).toBe('$0.00');
      expect(formatCurrency(NaN, 'USD')).toBe('$0.00');
    });
  });

  describe('formatNumber, formatDate, and formatTime resilience', () => {
    it('formats number safely with malformed locale', () => {
      const result = formatNumber(1234567.89, 'en-UNITED KINGDOM');
      expect(result).toContain('1,234,567.89');
    });

    it('formats date safely with malformed locale', () => {
      const date = new Date('2026-09-02T12:00:00Z');
      const result = formatDate(date, 'en-UNITED KINGDOM', 'UTC');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('formats time safely with malformed locale', () => {
      const date = new Date('2026-09-02T14:30:00Z');
      const result = formatTime(date, 'en-UNITED KINGDOM', 'UTC', '12h');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
