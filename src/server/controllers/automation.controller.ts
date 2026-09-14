import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { QueueManager } from '../queue/bullmq.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { TaskType } from '../queue/jobs.worker.js';

const VALID_TASKS = [
  'CHECK_LOW_STOCK',
  'DB_CLEANUP',
  'EXPIRE_PROMOTIONS',
  'EXPIRE_GIFT_CARDS',
  'REORDER_SUGGESTIONS',
  'LOYALTY_TIER_RECALC',
  'FLUSH_SCHEDULED_NOTIFS',
  'SYNC_OFFLINE_STATS',
  'GENERATE_DAILY_REPORT',
  'WARRANTY_EXPIRY_ALERT',
] as const;

type ValidTask = (typeof VALID_TASKS)[number];

export class AutomationController {
  // -------------------------------------------------------------------------
  // POST /automation/trigger
  // -------------------------------------------------------------------------
  public static async triggerJob(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { task } = req.body;
    if (!task) return next(new ValidationError('Task type is required.'));
    if (!VALID_TASKS.includes(task as ValidTask)) {
      return next(
        new ValidationError(`Unknown task "${task}". Valid tasks: ${VALID_TASKS.join(', ')}`)
      );
    }

    try {
      const manager = QueueManager.getInstance();
      const queue = manager.registerQueue('system-automation');

      if (!queue) {
        // Redis < 5: BullMQ unavailable — run task directly
        const { directDispatch } = await import('../queue/jobs.worker.js');
        await directDispatch(task as TaskType);
        res.status(201).json({
          success: true,
          message: `Task [${task}] executed directly (Redis Streams not supported on local Redis).`,
        });
        return;
      }

      const job = await queue.add(task, { task });

      res.status(201).json({
        success: true,
        message: `Task [${task}] submitted to background scheduler.`,
        jobId: job.id,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // GET /automation/metrics
  // -------------------------------------------------------------------------
  public static async listQueueMetrics(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const manager = QueueManager.getInstance();
      const [metrics, workers] = await Promise.all([
        manager.getQueueMetrics(),
        Promise.resolve(manager.getWorkerNames()),
      ]);

      res.json({
        activeWorkers: workers,
        queues: metrics,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // GET /automation/cron-jobs
  // -------------------------------------------------------------------------
  public static async listCronJobs(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const cronJobs = QueueManager.getInstance().listCronJobs();
      res.json(cronJobs);
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // POST /automation/queue/:name/pause
  // -------------------------------------------------------------------------
  public static async pauseQueue(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const name = String(req.params.name);
    try {
      const ok = await QueueManager.getInstance().pauseQueue(name);
      if (!ok) return next(new NotFoundError(`Queue "${name}" not found.`));
      res.json({ success: true, message: `Queue [${name}] paused.` });
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // POST /automation/queue/:name/resume
  // -------------------------------------------------------------------------
  public static async resumeQueue(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const name = String(req.params.name);
    try {
      const ok = await QueueManager.getInstance().resumeQueue(name);
      if (!ok) return next(new NotFoundError(`Queue "${name}" not found.`));
      res.json({ success: true, message: `Queue [${name}] resumed.` });
    } catch (err: unknown) {
      next(err);
    }
  }
}
