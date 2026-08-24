import { Counter, Gauge, Histogram } from 'prom-client';

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

export const redisOperationFailuresTotal = new Counter({
  name: 'redis_operation_failures_total',
  help: 'Total number of failed Redis operations',
  labelNames: ['operation'],
});

export const dependencyHealth = new Gauge({
  name: 'dependency_health',
  help: 'Health status of application dependencies',
  labelNames: ['dependency'],
});

export const outboxEvents = new Gauge({
  name: 'outbox_events',
  help: 'Current number of outbox events by status',
  labelNames: ['status'],
});
