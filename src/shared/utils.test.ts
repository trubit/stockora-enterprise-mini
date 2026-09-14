import { describe, it, expect } from 'vitest';
import { formatCurrency, isValidBarcode, capitalizeWords } from './utils.js';

describe('Shared Utilities', () => {
  describe('formatCurrency', () => {
    it('should format numbers to USD currency format by default', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format numbers according to custom currencies', () => {
      expect(formatCurrency(100, 'EUR')).toContain('100');
    });
  });

  describe('isValidBarcode', () => {
    it('should validate standard 8-14 character alphanumeric barcodes', () => {
      expect(isValidBarcode('12345678')).toBe(true);
      expect(isValidBarcode('SKU12345678')).toBe(true);
    });

    it('should fail on short or empty barcodes', () => {
      expect(isValidBarcode('')).toBe(false);
      expect(isValidBarcode('123')).toBe(false);
    });

    it('should fail on barcodes with special characters', () => {
      expect(isValidBarcode('SKU-1234-567')).toBe(false);
    });
  });

  describe('capitalizeWords', () => {
    it('should capitalize the first letter of each word', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
      expect(capitalizeWords('stockora enterprise pos')).toBe('Stockora Enterprise Pos');
    });
  });
});
