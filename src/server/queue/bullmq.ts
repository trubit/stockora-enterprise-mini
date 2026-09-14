/**
 * bullmq.ts
 * Singleton QueueManager: registers BullMQ queues, workers, and cron jobs.
 *
 * Redis Compatibility:
 *  BullMQ requires Redis ≥ 5.0 (uses Redis Streams: XADD/XREAD).
 *  Call QueueManager.checkRedisCompatibility() once at startup.
 *  If Redis < 5, isRedisCompatible will be false and all BullMQ
 *  operations are skipped — the jobs.worker.ts fallback scheduler takes over.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';

const REDIS_CONN = { url: config.redisUrl };

export interface QueueMetric {
  name: string;
  status: 'HEALTHY' | 'PAUSED' | 'ERROR';
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  concurrency: number;
  isPaused: boolean;
}

export interface CronJobSpec {
  queueName: string;
  jobName: string;
  cron: string; // Standard 5-field cron expression
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  data?: Record<string, any>;
}

export class QueueManager {
  private static instance: QueueManager | null = null;
  private queues: Map<string, Queue> = new Map();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  private workers: Map<string, Worker<any, any, string>> = new Map();
  private cronSpecs: CronJobSpec[] = [];

  // Set to false when Redis < 5 detected — disables all BullMQ operations
  public static isRedisCompatible = true;

  private constructor() {}

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Probe the running Redis instance version using ioredis.
   * Must be called before any BullMQ queue/worker registration.
   */
  public static async checkRedisCompatibility(): Promise<boolean> {
    try {
      // Dynamic import to avoid circular deps — redis.ts is already initialised by now
      const { redis } = await import('../database/redis.js');
      if (redis.status !== 'ready') {
        logger.info(
          '[BullMQ] Redis not ready at startup — BullMQ disabled; falling back to Node.js setInterval scheduler.'
        );
        QueueManager.isRedisCompatible = false;
        return false;
      }

      const infoPromise = redis.info('server');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis info probe timeout')), 2000)
      );
      const info: string = await Promise.race([infoPromise, timeoutPromise]);
      const match = info.match(/redis_version:(\d+)\.\d+\.\d+/);
      if (match) {
        const major = parseInt(match[1], 10);
        if (major < 5) {
          logger.info(
            `[BullMQ] Redis version ${match[1]}.x detected — Redis Streams require ≥ 5.0. ` +
              'BullMQ disabled; falling back to Node.js setInterval scheduler.'
          );
          QueueManager.isRedisCompatible = false;
          return false;
        }
        logger.info(`[BullMQ] Redis version ${match[1]}.x — BullMQ fully supported.`);
        QueueManager.isRedisCompatible = true;
        return true;
      }
    } catch (err: any) {
      logger.warn(
        `[BullMQ] Could not determine Redis version (${err?.message || err}) — assuming incompatible.`
      );
      QueueManager.isRedisCompatible = false;
    }
    return QueueManager.isRedisCompatible;
  }

  // ---- Queue ----------------------------------------------------------------

  public registerQueue(name: string): Queue | null {
    if (!QueueManager.isRedisCompatible) return null;
    if (this.queues.has(name)) return this.queues.get(name)!;
    const queue = new Queue(name, { connection: REDIS_CONN, skipVersionCheck: true });
    this.queues.set(name, queue);
    logger.info(`BullMQ Queue registered: [${name}]`);
    return queue;
  }

  // ---- Worker ---------------------------------------------------------------

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  public registerWorker(name: string, handler: (job: Job<any>) => Promise<void>): Worker | null {
    if (!QueueManager.isRedisCompatible) return null;
    if (this.workers.has(name)) return this.workers.get(name)!;

    const worker = new Worker(
      name,
      async (job) => {
        logger.info(
          `Processing BullMQ job [${job.id}] in queue [${name}]: task=${job.data?.task ?? job.name}`
        );
        await handler(job);
      },
      { connection: REDIS_CONN, concurrency: 5, skipVersionCheck: true }
    );

    worker.on('failed', (job, err) => {
      logger.error(`BullMQ job [${job?.id}] failed in worker [${name}]:`, err);
    });

    worker.on('completed', (job) => {
      logger.info(`BullMQ job [${job.id}] completed in worker [${name}]`);
    });

    this.workers.set(name, worker);
    logger.info(`BullMQ Worker active for queue: [${name}]`);
    return worker;
  }

  // ---- Cron Jobs ------------------------------------------------------------

  public async registerCronJob(spec: CronJobSpec): Promise<void> {
    if (!QueueManager.isRedisCompatible) return;
    const queue = this.registerQueue(spec.queueName);
    if (!queue) return;
    await queue.add(
      spec.jobName,
      { task: spec.jobName, ...spec.data },
      {
        repeat: { pattern: spec.cron },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      }
    );
    this.cronSpecs.push(spec);
    logger.info(
      `BullMQ CronJob registered: [${spec.jobName}] @ "${spec.cron}" on queue [${spec.queueName}]`
    );
  }

  public listCronJobs(): CronJobSpec[] {
    return [...this.cronSpecs];
  }

  // ---- Queue Control --------------------------------------------------------

  public async pauseQueue(name: string): Promise<boolean> {
    if (!QueueManager.isRedisCompatible) return false;
    const queue = this.queues.get(name);
    if (!queue) return false;
    await queue.pause();
    logger.info(`BullMQ Queue paused: [${name}]`);
    return true;
  }

  public async resumeQueue(name: string): Promise<boolean> {
    if (!QueueManager.isRedisCompatible) return false;
    const queue = this.queues.get(name);
    if (!queue) return false;
    await queue.resume();
    logger.info(`BullMQ Queue resumed: [${name}]`);
    return true;
  }

  // ---- Metrics --------------------------------------------------------------

  public async getQueueMetrics(): Promise<QueueMetric[]> {
    if (!QueueManager.isRedisCompatible || this.queues.size === 0) {
      return [
        {
          name: 'system-automation',
          status: 'HEALTHY',
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          concurrency: 5,
          isPaused: false,
        },
      ];
    }
    const results: QueueMetric[] = [];
    for (const [name, queue] of this.queues.entries()) {
      try {
        const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);
        results.push({
          name,
          status: isPaused ? 'PAUSED' : failed > 10 ? 'ERROR' : 'HEALTHY',
          waiting,
          active,
          completed,
          failed,
          delayed,
          concurrency: 5,
          isPaused,
        });
      } catch {
        results.push({
          name,
          status: 'ERROR',
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          concurrency: 5,
          isPaused: false,
        });
      }
    }
    return results;
  }

  public getWorkerNames(): string[] {
    return [...this.workers.keys()];
  }

  // ---- Shutdown -------------------------------------------------------------

  public async shutdown(): Promise<void> {
    logger.info('Closing all BullMQ queues and workers...');
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        logger.info(`Queue [${name}] closed.`);
      } catch {
        // ignore
      }
    }
    for (const [name, worker] of this.workers.entries()) {
      try {
        await worker.close();
        logger.info(`Worker [${name}] closed.`);
      } catch {
        // ignore
      }
    }
  }
}
