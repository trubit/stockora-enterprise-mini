import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { TelemetryMetric } from '../models/TelemetryMetric.js';
import { Incident } from '../models/Incident.js';
import { ObservabilityService } from '../services/observability.service.js';

describe('Phase 27 Observability telemetry, metrics, and incident audits', () => {
  const companyId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_observability');
    await Promise.all([TelemetryMetric.deleteMany({}), Incident.deleteMany({})]);
  });

  afterAll(async () => {
    await Promise.all([TelemetryMetric.deleteMany({}), Incident.deleteMany({})]);
    await mongoose.connection.close();
  });

  it('should correctly capture, persist, and retrieve telemetry metrics', async () => {
    // 1. Log mock API metric durations
    await TelemetryMetric.create([
      {
        metricName: 'http_request_duration_ms',
        value: 120,
        labels: { path: '/api/v1/pos/checkout', method: 'POST', status: '200' },
      },
      {
        metricName: 'http_request_duration_ms',
        value: 80,
        labels: { path: '/api/v1/pos/checkout', method: 'POST', status: '200' },
      },
    ]);

    // 2. Fetch aggregated system resources using ObservabilityService
    const metrics = await ObservabilityService.getSystemMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.cpu).toHaveProperty('loadAvg');
    expect(metrics.memory).toHaveProperty('processHeap');
    expect(metrics.apiMetrics.totalRequests).toBeGreaterThanOrEqual(2);
    expect(metrics.apiMetrics.avgLatencyMs).toBe(100); // (120 + 80) / 2
  }, 15000);

  it('should trigger alert escalations and log incident records on high CPU simulation', async () => {
    // Create CPU breach warning log
    await ObservabilityService.logIncident(
      companyId.toString(),
      'High CPU Load warning',
      'CPU load average simulated breach (100% capacity).',
      'CRITICAL'
    );

    // Assert incident was logged into DB
    const ticket = await Incident.findOne({ companyId, title: 'High CPU Load warning' });
    expect(ticket).toBeDefined();
    expect(ticket?.status).toBe('OPEN');
    expect(ticket?.severity).toBe('CRITICAL');
  });
});
