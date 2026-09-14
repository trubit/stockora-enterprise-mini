import { describe, it, expect } from 'vitest';
import {
  calculateDelay,
  CircuitBreaker,
  Bulkhead,
  RetryBudget,
  ResilientExecutor,
} from '../utils/resiliency/index.js';

describe('Phase 17 Resiliency & Retry Engine', () => {
  describe('Backoff and Jitter Engine', () => {
    it('should compute fixed delay correctly', () => {
      const delay = calculateDelay(1, 'FIXED', 'NONE', 500, 2000);
      expect(delay).toBe(500);
    });

    it('should compute linear delay correctly', () => {
      const delay = calculateDelay(2, 'LINEAR', 'NONE', 100, 1000);
      // linear: baseDelay * (attempt + 1) -> 100 * (2 + 1) = 300
      expect(delay).toBe(300);
    });

    it('should compute exponential backoff and cap at maxDelay', () => {
      const delay = calculateDelay(5, 'EXPONENTIAL', 'NONE', 100, 1000);
      // exp: 100 * 2^5 = 3200 capped at maxDelay = 1000
      expect(delay).toBe(1000);
    });

    it('should apply full jitter within correct bounds', () => {
      const delay = calculateDelay(3, 'EXPONENTIAL', 'FULL', 200, 5000);
      // max delay without jitter is 200 * 2^3 = 1600
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1600);
    });
  });

  describe('Circuit Breaker state-machine', () => {
    it('should transit CLOSED -> OPEN after threshold failures', () => {
      const cb = new CircuitBreaker('TestBreaker', 3, 1000);
      expect(cb.getState()).toBe('CLOSED');

      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('CLOSED');

      cb.recordFailure();
      expect(cb.getState()).toBe('OPEN');
    });

    it('should transit OPEN -> HALF_OPEN after reset timeout', async () => {
      const cb = new CircuitBreaker('TestBreakerShort', 2, 50);
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('OPEN');

      // wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(cb.getState()).toBe('HALF_OPEN');
    });

    it('should reset back to CLOSED on successful test in HALF_OPEN', async () => {
      const cb = new CircuitBreaker('TestBreakerReset', 2, 50);
      cb.recordFailure();
      cb.recordFailure();

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(cb.getState()).toBe('HALF_OPEN');

      cb.recordSuccess();
      cb.recordSuccess();
      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('Bulkhead Concurrency Isolation', () => {
    it('should limit active execution concurrency', async () => {
      const bulkhead = new Bulkhead('TestBulkhead', 2);
      const active: boolean[] = [];

      const runTask = async () => {
        return bulkhead.execute(async () => {
          active.push(true);
          await new Promise((resolve) => setTimeout(resolve, 50));
          active.pop();
        });
      };

      // Dispatch 3 tasks concurrently
      const p1 = runTask();
      const p2 = runTask();
      const p3 = runTask();

      // Check that at most 2 are active at the beginning
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(active.length).toBeLessThanOrEqual(2);

      await Promise.all([p1, p2, p3]);
      expect(active.length).toBe(0);
    });
  });

  describe('Token-Bucket Retry Budget', () => {
    it('should allow retries within budget and block when empty', () => {
      const budget = new RetryBudget(20, 10, 0); // starts with 20 tokens, cost is 10, no refill
      expect(budget.acquire()).toBe(true);
      expect(budget.acquire()).toBe(true);
      expect(budget.acquire()).toBe(false); // exhausted
    });
  });

  describe('ResilientExecutor integration', () => {
    it('should execute successfully on initial call', async () => {
      const res = await ResilientExecutor.execute(
        { name: 'SuccessCall', retryCount: 2 },
        async () => 'Hello'
      );
      expect(res).toBe('Hello');
    });

    it('should timeout when task execution exceeds limit', async () => {
      await expect(
        ResilientExecutor.execute({ name: 'TimeoutCall', timeoutMs: 30 }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'Slow';
        })
      ).rejects.toThrow('timed out');
    });

    it('should retry on failure and eventually succeed', async () => {
      let tries = 0;
      const res = await ResilientExecutor.execute(
        {
          name: 'RetrySuccessCall',
          retryCount: 3,
          baseDelayMs: 5,
          maxDelayMs: 20,
          backoffType: 'FIXED',
          jitterType: 'NONE',
          isIdempotent: true,
        },
        async () => {
          tries++;
          if (tries < 3) throw new Error('Attempt failed');
          return 'Succeeded';
        }
      );
      expect(res).toBe('Succeeded');
      expect(tries).toBe(3);
    });
  });
});
