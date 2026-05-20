import { describe, it, expect } from 'vitest';
import { registry } from './metrics.js';

describe('metrics registry', () => {
  it('returns valid Prometheus text format', async () => {
    const text = await registry.metrics();

    // Every metric must have a # HELP and # TYPE line.
    expect(text).toMatch(/^# HELP gtarp_events_received_total/m);
    expect(text).toMatch(/^# TYPE gtarp_events_received_total counter/m);

    expect(text).toMatch(/^# HELP gtarp_events_deduped_total/m);
    expect(text).toMatch(/^# TYPE gtarp_events_deduped_total counter/m);

    expect(text).toMatch(/^# HELP gtarp_jobs_enqueued_total/m);
    expect(text).toMatch(/^# TYPE gtarp_jobs_enqueued_total counter/m);

    expect(text).toMatch(/^# HELP gtarp_queue_depth/m);
    expect(text).toMatch(/^# TYPE gtarp_queue_depth gauge/m);
  });

  it('exposes content-type application/openmetrics-text or text/plain', async () => {
    const contentType = registry.contentType;
    expect(contentType).toMatch(/text\/plain|application\/openmetrics-text/);
  });
});
