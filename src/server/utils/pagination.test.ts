import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { parsePaginationParams, formatPaginatedResult } from './pagination.js';

describe('Pagination Utilities', () => {
  describe('parsePaginationParams', () => {
    it('should extract valid limits, page sizes, and sorting targets', () => {
      const mockReq = {
        query: {
          page: '2',
          limit: '15',
          sortBy: 'sku',
          sortOrder: 'desc',
        },
      } as unknown as Request;

      const params = parsePaginationParams(mockReq);
      expect(params.page).toBe(2);
      expect(params.limit).toBe(15);
      expect(params.skip).toBe(15);
      expect(params.sortBy).toBe('sku');
      expect(params.sortOrder).toBe('desc');
    });

    it('should default configuration limits when parameters are missing', () => {
      const mockReq = {
        query: {},
      } as unknown as Request;

      const params = parsePaginationParams(mockReq, 'name');
      expect(params.page).toBe(1);
      expect(params.limit).toBe(10);
      expect(params.skip).toBe(0);
      expect(params.sortBy).toBe('name');
      expect(params.sortOrder).toBe('asc');
    });
  });

  describe('formatPaginatedResult', () => {
    it('should compute meta pages cleanly', () => {
      const params = { page: 1, limit: 10, skip: 0, sortBy: 'name', sortOrder: 'asc' as const };
      const data = ['item1', 'item2'];
      const result = formatPaginatedResult(data, 25, params);

      expect(result.data).toEqual(data);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3);
    });
  });
});
