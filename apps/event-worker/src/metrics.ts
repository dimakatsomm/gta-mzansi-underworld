import { Counter, Gauge, Registry } from 'prom-client';

export const registry = new Registry();

export const eventsReceivedTotal = new Counter({
  name: 'gtarp_events_received_total',
  help: 'Total domain events received from NATS',
  labelNames: ['subject'] as const,
  registers: [registry],
});

export const eventsDedupedTotal = new Counter({
  name: 'gtarp_events_deduped_total',
  help: 'Total domain events skipped due to Redis dedup',
  registers: [registry],
});

export const jobsEnqueuedTotal = new Counter({
  name: 'gtarp_jobs_enqueued_total',
  help: 'Total BullMQ jobs enqueued',
  labelNames: ['queue'] as const,
  registers: [registry],
});

export const queueDepthGauge = new Gauge({
  name: 'gtarp_queue_depth',
  help: 'Current BullMQ queue depth',
  labelNames: ['queue'] as const,
  registers: [registry],
});
