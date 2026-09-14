import { SocketManager } from '../sockets/manager.js';
import { logger } from '../logger.js';
import { ObservabilityService } from './observability.service.js';
import os from 'os';

export class AlertingService {
  /**
   * Monitor health signals and broadcast alerts via WebSockets
   */
  public static async sweepSystemHealth(companyId: string): Promise<void> {
    const memFreePercent = (os.freemem() / os.totalmem()) * 100;
    const loadAvg1Min = os.loadavg()[0];
    const cpusCount = os.cpus().length;

    const io = SocketManager.getInstance();

    // 1. High CPU check
    if (loadAvg1Min > cpusCount * 0.85) {
      logger.warn(
        `[Alerting] High CPU Load detected: ${loadAvg1Min.toFixed(2)} on ${cpusCount} cores.`
      );
      io.emitGlobal('telemetry:alert', {
        severity: 'CRITICAL',
        title: 'High CPU Load warning',
        message: `CPU load average is currently ${loadAvg1Min.toFixed(2)}, exceeding SRE safety boundaries.`,
      });

      await ObservabilityService.logIncident(
        companyId,
        'High CPU Load warning',
        `Load average: ${loadAvg1Min.toFixed(2)}`,
        'CRITICAL'
      );
    }

    // 2. High memory usage check
    if (memFreePercent < 10) {
      logger.warn(
        `[Alerting] High Memory usage detected: Only ${memFreePercent.toFixed(2)}% free.`
      );
      io.emitGlobal('telemetry:alert', {
        severity: 'WARNING',
        title: 'High Memory usage warning',
        message: `Available system RAM is down to ${memFreePercent.toFixed(2)}% free.`,
      });
    }
  }
}
