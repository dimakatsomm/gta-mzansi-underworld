import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { adminRoutes } from './routes.js';
import type { RecentUsageRow, MetricsSummary } from './routes.js';

const sampleRows: RecentUsageRow[] = [
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    tier: 1,
    purpose: 'dispatch',
    promptTokens: 100,
    completionTokens: 200,
    costUsd: 0.005,
    cacheHit: false,
    occurredAt: new Date('2025-01-01T12:00:00Z'),
  },
];

const sampleSummary: MetricsSummary = {
  totalCostUsd24h: 12.5,
  callsByTier: { '0': 50, '1': 200, '2': 30 },
  callsByPurpose: { dispatch: 100, witness: 80, media: 100 },
  cacheHitRate: 0.72,
};

async function buildTestServer() {
  const app = Fastify({ logger: false });
  await app.register(adminRoutes, {
    getRecentUsage: async () => sampleRows,
    getMetricsSummary: async () => sampleSummary,
  });
  await app.ready();
  return app;
}

describe('adminRoutes', () => {
  it('GET /admin/ai-usage returns JSON array', async () => {
    const app = await buildTestServer();
    const res = await app.inject({ method: 'GET', url: '/admin/ai-usage' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const body = res.json<RecentUsageRow[]>();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0]?.provider).toBe('anthropic');
    await app.close();
  });

  it('GET /metrics returns Prometheus-format text', async () => {
    const app = await buildTestServer();
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    const text = res.body;
    expect(text).toContain('ai_cost_usd_24h 12.5');
    expect(text).toContain('ai_calls_24h{tier="1"} 200');
    expect(text).toContain('ai_cache_hit_rate 0.72');
    expect(text).toContain('# HELP ai_cost_usd_24h');
    await app.close();
  });

  it('GET /metrics ends with newline', async () => {
    const app = await buildTestServer();
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body.endsWith('\n')).toBe(true);
    await app.close();
  });
});
