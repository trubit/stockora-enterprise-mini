import { logger } from '../../logger.js';

// ---- Resiliency Configuration Types -----------------------------------------

export type BackoffType = 'EXPONENTIAL' | 'LINEAR' | 'FIXED' | 'ADAPTIVE';
export type JitterType = 'FULL' | 'EQUAL' | 'DECORRELATED' | 'NONE';

export interface ResiliencyOptions {
  name: string; // The identifier for the service / operation (e.g. 'MongoDB', 'SMTP-Email')
  retryCount?: number; // Max retry attempts (default: 3)
  timeoutMs?: number; // Timeout limit for each attempt (default: 0 = disabled)
  backoffType?: BackoffType; // Delay strategy (default: 'EXPONENTIAL')
  jitterType?: JitterType; // Random variation (default: 'FULL')
  baseDelayMs?: number; // Starting delay (default: 200ms)
  maxDelayMs?: number; // Caps delay growth (default: 5000ms)
  useCircuitBreaker?: boolean; // Enable state protection (default: false)
  circuitFailureThreshold?: number; // Failures before opening (default: 5)
  circuitResetTimeoutMs?: number; // Time before test recovery (default: 10000ms)
  bulkheadMaxConcurrency?: number; // Limits concurrent streams (default: 0 = disabled)
  isIdempotent?: boolean; // Safe to retry multiple times without side effects
  idempotencyKey?: string; // Optional deduplication key
}

export interface MetricEntry {
  name: string;
  attempts: number;
  successes: number;
  failures: number;
  timeouts: number;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failuresSinceLastSuccess: number;
}

// ---- Backoff & Jitter Delay Engine ------------------------------------------

export function calculateDelay(
  attempt: number,
  type: BackoffType,
  jitter: JitterType,
  baseDelay: number,
  maxDelay: number,
  lastDelay = 0
): number {
  let delay = baseDelay;

  switch (type) {
    case 'EXPONENTIAL':
      delay = baseDelay * Math.pow(2, attempt);
      break;
    case 'LINEAR':
      delay = baseDelay * (attempt + 1);
      break;
    case 'FIXED':
      delay = baseDelay;
      break;
    case 'ADAPTIVE':
      delay = baseDelay * Math.pow(1.5, attempt);
      break;
  }

  delay = Math.min(delay, maxDelay);

  switch (jitter) {
    case 'FULL':
      delay = Math.random() * delay;
      break;
    case 'EQUAL':
      delay = delay / 2 + Math.random() * (delay / 2);
      break;
    case 'DECORRELATED': {
      const minVal = baseDelay;
      const maxVal = lastDelay * 3;
      const range = Math.abs(maxVal - minVal);
      delay = Math.min(maxDelay, minVal + Math.random() * range);
      break;
    }
    case 'NONE':
    default:
      break;
  }

  return Math.round(delay);
}

// ---- Circuit Breaker Implementation -----------------------------------------

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastStateChange: number = Date.now();

  constructor(
    public readonly name: string,
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 10000
  ) {}

  public getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    this.checkStateTransition();
    return this.state;
  }

  public recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= 2) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      this.failures = 0;
    }
  }

  public recordFailure() {
    this.failures++;
    this.lastStateChange = Date.now();

    if (this.state === 'CLOSED' && this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error(`[Resiliency] Circuit breaker [${this.name}] OPENED. Blocking requests.`);
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.error(
        `[Resiliency] Circuit breaker [${this.name}] failed HALF-OPEN test. Re-opening.`
      );
    }
  }

  private reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastStateChange = Date.now();
    logger.info(`[Resiliency] Circuit breaker [${this.name}] recovered and is now CLOSED.`);
  }

  private checkStateTransition() {
    if (this.state === 'OPEN' && Date.now() - this.lastStateChange > this.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
      this.successes = 0;
      this.lastStateChange = Date.now();
      logger.warn(
        `[Resiliency] Circuit breaker [${this.name}] transition to HALF-OPEN (Testing recovery).`
      );
    }
  }

  public forceReset() {
    this.reset();
  }

  public forceOpen() {
    this.state = 'OPEN';
    this.failures = this.failureThreshold;
    this.lastStateChange = Date.now();
  }
}

// ---- Bulkhead (Concurrency Limiter) -----------------------------------------

export class Bulkhead {
  private activeCount = 0;
  private queue: (() => void)[] = [];

  constructor(
    public readonly name: string,
    private maxConcurrency: number
  ) {}

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      logger.warn(
        `[Resiliency] Bulkhead [${this.name}] capacity reached (${this.activeCount}/${this.maxConcurrency}). Queueing execution.`
      );
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

// ---- Token Bucket Retry Budget ----------------------------------------------

export class RetryBudget {
  private tokens: number;
  private lastRefill: number = Date.now();

  constructor(
    private maxTokens: number = 100,
    private tokenCost: number = 10,
    private refillRatePerSec: number = 2
  ) {
    this.tokens = maxTokens;
  }

  public acquire(): boolean {
    this.refill();
    if (this.tokens >= this.tokenCost) {
      this.tokens -= this.tokenCost;
      return true;
    }
    return false;
  }

  public release() {
    this.refill();
    this.tokens = Math.min(this.maxTokens, this.tokens + 1);
  }

  private refill() {
    const now = Date.now();
    const elapsedSecs = (now - this.lastRefill) / 1000;
    if (elapsedSecs > 0) {
      const generated = elapsedSecs * this.refillRatePerSec;
      this.tokens = Math.min(this.maxTokens, this.tokens + generated);
      this.lastRefill = now;
    }
  }

  public getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// ---- Resiliency Observability Registry --------------------------------------

export class ResiliencyRegistry {
  private static instance: ResiliencyRegistry | null = null;
  private metrics: Map<string, MetricEntry> = new Map();
  private breakers: Map<string, CircuitBreaker> = new Map();
  private bulkheads: Map<string, Bulkhead> = new Map();
  private budgets: Map<string, RetryBudget> = new Map();

  private constructor() {}

  public static getInstance(): ResiliencyRegistry {
    if (!ResiliencyRegistry.instance) {
      ResiliencyRegistry.instance = new ResiliencyRegistry();
    }
    return ResiliencyRegistry.instance;
  }

  public getOrCreateMetric(name: string): MetricEntry {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        attempts: 0,
        successes: 0,
        failures: 0,
        timeouts: 0,
        circuitState: 'CLOSED',
        failuresSinceLastSuccess: 0,
      });
    }
    return this.metrics.get(name)!;
  }

  public getOrCreateCircuitBreaker(name: string, threshold = 5, timeout = 10000): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, threshold, timeout));
    }
    return this.breakers.get(name)!;
  }

  public getOrCreateBulkhead(name: string, maxConcurrency = 10): Bulkhead {
    if (!this.bulkheads.has(name)) {
      this.bulkheads.set(name, new Bulkhead(name, maxConcurrency));
    }
    return this.bulkheads.get(name)!;
  }

  public getOrCreateRetryBudget(name: string, maxTokens = 100, cost = 10): RetryBudget {
    if (!this.budgets.has(name)) {
      this.budgets.set(name, new RetryBudget(maxTokens, cost));
    }
    return this.budgets.get(name)!;
  }

  public getMetricsList(): MetricEntry[] {
    const list: MetricEntry[] = [];
    for (const [name, entry] of this.metrics.entries()) {
      const breaker = this.breakers.get(name);
      list.push({
        ...entry,
        circuitState: breaker ? breaker.getState() : 'CLOSED',
      });
    }
    return list;
  }

  public resetAll() {
    this.metrics.clear();
    for (const breaker of this.breakers.values()) {
      breaker.forceReset();
    }
    logger.info('[Resiliency] Reset all central resiliency statistics and states.');
  }

  public getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }
}

// ---- Unified Resilient Execution Wrapper ------------------------------------

export class ResilientExecutor {
  /**
   * Resilient execute wrapper. Wraps task functions in bulkheads, circuit breakers,
   * retry policies with jittered backoffs, and Token Bucket budgets.
   */
  public static async execute<T>(options: ResiliencyOptions, taskFn: () => Promise<T>): Promise<T> {
    const { name, bulkheadMaxConcurrency = 0 } = options;

    const registry = ResiliencyRegistry.getInstance();
    const metrics = registry.getOrCreateMetric(name);

    // 1. Bulkhead Isolation Check
    if (bulkheadMaxConcurrency > 0) {
      const bulkhead = registry.getOrCreateBulkhead(name, bulkheadMaxConcurrency);
      return bulkhead.execute(() => this.executeInternal(options, metrics, taskFn));
    }

    return this.executeInternal(options, metrics, taskFn);
  }

  private static async executeInternal<T>(
    options: ResiliencyOptions,
    metrics: MetricEntry,
    taskFn: () => Promise<T>
  ): Promise<T> {
    const {
      name,
      retryCount = 3,
      timeoutMs = 0,
      backoffType = 'EXPONENTIAL',
      jitterType = 'FULL',
      baseDelayMs = 200,
      maxDelayMs = 5000,
      useCircuitBreaker = false,
      circuitFailureThreshold = 5,
      circuitResetTimeoutMs = 10000,
      isIdempotent = false,
    } = options;

    const registry = ResiliencyRegistry.getInstance();

    // 2. Circuit Breaker State Check
    let breaker: CircuitBreaker | null = null;
    if (useCircuitBreaker) {
      breaker = registry.getOrCreateCircuitBreaker(
        name,
        circuitFailureThreshold,
        circuitResetTimeoutMs
      );
      if (breaker.getState() === 'OPEN') {
        metrics.failures++;
        throw new Error(`[Resiliency] Blocked by Circuit Breaker [${name}] (State: OPEN)`);
      }
    }

    // 3. Token-Bucket Budget Check (to protect client/external services from retry storms)
    const budget = registry.getOrCreateRetryBudget(name);

    let lastDelay = 0;
    let attempt = 0;

    while (attempt <= retryCount) {
      attempt++;
      metrics.attempts++;

      // Check if we should retry or skip if budget token exhaustion is reached (only applies to retries, not initial call)
      if (attempt > 1 && !budget.acquire()) {
        logger.warn(`[Resiliency] Retry budget exhausted for service [${name}]. Retries blocked.`);
        throw new Error(`[Resiliency] Retry budget limit exceeded for execution on [${name}]`);
      }

      try {
        // 4. Timeout-wrapped execution
        let result: T;
        if (timeoutMs > 0) {
          result = await this.executeWithTimeout(taskFn, timeoutMs, name, metrics);
        } else {
          result = await taskFn();
        }

        // Success path
        metrics.successes++;
        metrics.failuresSinceLastSuccess = 0;
        budget.release();
        if (breaker) breaker.recordSuccess();
        return result;
      } catch (err) {
        metrics.failures++;
        metrics.failuresSinceLastSuccess++;
        if (breaker) breaker.recordFailure();

        // Check if we can/should retry
        const isLastAttempt = attempt > retryCount;
        const retryAllowed = !isLastAttempt && (isIdempotent || attempt === 1);

        if (!retryAllowed) {
          // Dead Letter / Poison message audit log trigger
          if (isLastAttempt) {
            logger.error(
              `[Resiliency] Resiliency retries exhausted on [${name}]. Logging to Poison Logs/DLQ. Details:`,
              err
            );
          } else {
            logger.error(
              `[Resiliency] Non-idempotent operation failed on [${name}]. Skipping retries to prevent duplicate side effects.`,
              err
            );
          }
          throw err;
        }

        // Calculate and wait delay before retry
        const delay = calculateDelay(
          attempt - 1,
          backoffType,
          jitterType,
          baseDelayMs,
          maxDelayMs,
          lastDelay
        );
        lastDelay = delay;

        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn(
          `[Resiliency] Retry attempt #${attempt} for [${name}] in ${delay}ms due to error: ${errMsg}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `[Resiliency] Maximum retry attempts (${retryCount}) exhausted on service [${name}]`
    );
  }

  private static async executeWithTimeout<T>(
    taskFn: () => Promise<T>,
    timeoutMs: number,
    name: string,
    metrics: MetricEntry
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        metrics.timeouts++;
        reject(new Error(`[Resiliency] Operation timed out after ${timeoutMs}ms on [${name}]`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([taskFn(), timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    }
  }
}

export async function executeWithResiliency<T>(
  taskFn: () => Promise<T>,
  options: ResiliencyOptions
): Promise<T> {
  return ResilientExecutor.execute(options, taskFn);
}
