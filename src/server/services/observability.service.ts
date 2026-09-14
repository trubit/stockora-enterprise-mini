import os from 'os';
import mongoose from 'mongoose';
import { redis } from '../database/redis.js';
import { TelemetryMetric } from '../models/TelemetryMetric.js';
import { Incident } from '../models/Incident.js';

export class ObservabilityService {
  /**
   * Aggregate recent performance indicators and system resources
   */
  public static async getSystemMetrics(): Promise<{
    cpu: { loadAvg: number[]; count: number };
    memory: { total: number; free: number; processHeap: number };
    services: { database: string; cache: string };
    apiMetrics: { totalRequests: number; avgLatencyMs: number };
  }> {
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();

    // Redis liveness check
    let cacheStatus = 'UNHEALTHY';
    try {
      const pong = await redis.ping();
      if (pong === 'PONG') cacheStatus = 'HEALTHY';
    } catch {
      cacheStatus = 'UNHEALTHY';
    }

    // Database connection status
    const dbStatus = mongoose.connection.readyState === 1 ? 'HEALTHY' : 'UNHEALTHY';

    // Aggregate recent API metrics (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMetrics = await TelemetryMetric.aggregate([
      { $match: { metricName: 'http_request_duration_ms', createdAt: { $gte: oneHourAgo } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgDuration: { $avg: '$value' },
        },
      },
    ]);

    const totalRequests = recentMetrics[0]?.total || 0;
    const avgLatencyMs = Math.round(recentMetrics[0]?.avgDuration || 0);

    return {
      cpu: {
        loadAvg: os.loadavg(),
        count: cpus.length,
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        processHeap: memoryUsage.heapUsed,
      },
      services: {
        database: dbStatus,
        cache: cacheStatus,
      },
      apiMetrics: {
        totalRequests,
        avgLatencyMs,
      },
    };
  }

  /**
   * Log platform performance issue or incident auto-escalation
   */
  public static async logIncident(
    companyId: string,
    title: string,
    description: string,
    severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY'
  ): Promise<void> {
    await Incident.create({
      companyId: new mongoose.Types.ObjectId(companyId),
      title,
      description,
      status: 'OPEN',
      severity,
      timeline: [{ message: 'Incident automatically opened by platform telemetry monitor.' }],
    });
  }
}
