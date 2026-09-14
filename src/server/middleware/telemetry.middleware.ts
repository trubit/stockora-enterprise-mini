import type { Request, Response, NextFunction } from 'express';
import { TelemetryMetric } from '../models/TelemetryMetric.js';
import { logger } from '../logger.js';
import crypto from 'crypto';

interface MetricBufferItem {
  metricName: string;
  value: number;
  labels: { path: string; method: string; status: string };
  timestamp?: Date;
}

const metricBatchBuffer: MetricBufferItem[] = [];
let batchFlushTimer: NodeJS.Timeout | null = null;

function scheduleBatchFlush() {
  if (batchFlushTimer) return;
  batchFlushTimer = setTimeout(flushTelemetryBatch, 10000); // Flush every 10 seconds
}

async function flushTelemetryBatch() {
  batchFlushTimer = null;
  if (metricBatchBuffer.length === 0) return;

  const itemsToInsert = metricBatchBuffer.splice(0, metricBatchBuffer.length);
  try {
    await TelemetryMetric.insertMany(itemsToInsert, { ordered: false });
  } catch (err: any) {
    logger.warn(`[Observability] Batch telemetry log warning: ${err.message}`);
  }
}

export function telemetryMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = req.baseUrl + req.path;
    const method = req.method;
    const status = res.statusCode.toString();

    metricBatchBuffer.push(
      {
        metricName: 'http_request_duration_ms',
        value: duration,
        labels: { path, method, status },
      },
      {
        metricName: 'http_requests_total',
        value: 1,
        labels: { path, method, status },
      }
    );

    if (metricBatchBuffer.length >= 100) {
      flushTelemetryBatch().catch(() => {});
    } else {
      scheduleBatchFlush();
    }
  });

  next();
}
