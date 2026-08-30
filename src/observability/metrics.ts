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

export const orderStepDurationSeconds = new Histogram({
  name: 'order_step_duration_seconds',
  help: 'Order processing step duration in seconds',
  labelNames: ['step'],
  buckets: [0.001, 0.003, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5],
});

export const orderNotificationConsumerStepDurationSeconds = new Histogram({
  name: 'order_notification_consumer_step_duration_seconds',
  help: 'Order notification consumer processing step duration in seconds',
  labelNames: ['step'],
  buckets: [0.001, 0.003, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2],
});

export const outboxPublisherDurationSeconds = new Histogram({
  name: 'outbox_publisher_duration_seconds',
  help: 'Outbox publisher cycle duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
});

export const outboxPublisherEvents = new Histogram({
  name: 'outbox_publisher_events',
  help: 'Number of pending outbox events fetched per publisher cycle',
  buckets: [0, 1, 10, 50, 100, 250, 500, 1000, 2500],
});

export const outboxPublisherActiveExecutions = new Gauge({
  name: 'outbox_publisher_active_executions',
  help: 'Number of currently running outbox publisher cycles',
});

export const outboxPublisherSkippedTotal = new Counter({
  name: 'outbox_publisher_skipped_total',
  help: 'Number of outbox publisher cycles skipped because another cycle was already running',
});
