import type { FastifyInstance } from 'fastify';

export interface RecentUsageRow {
  provider: string;
  model: string;
  tier: number;
  purpose: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  cacheHit: boolean;
  occurredAt: Date;
}

export interface MetricsSummary {
  totalCostUsd24h: number;
  callsByTier: Record<string, number>;
  callsByPurpose: Record<string, number>;
  cacheHitRate: number;
}

export interface AdminDeps {
  getRecentUsage(): Promise<RecentUsageRow[]>;
  getMetricsSummary(): Promise<MetricsSummary>;
}

export async function adminRoutes(app: FastifyInstance, opts: AdminDeps): Promise<void> {
  app.get('/admin/ai-usage', async (_req, reply) => {
    const rows = await opts.getRecentUsage();
    return reply.send(rows);
  });

  app.get('/metrics', async (_req, reply) => {
    const summary = await opts.getMetricsSummary();
    const lines = [
      `# HELP ai_cost_usd_24h Total AI cost in USD over last 24 hours`,
      `# TYPE ai_cost_usd_24h gauge`,
      `ai_cost_usd_24h ${summary.totalCostUsd24h}`,
      // Emitted from a 24h rolling summary, not a process-lifetime counter,
      // so this is a gauge — values can fall between scrapes. Use this with
      // `last_over_time()` / `avg_over_time()` in PromQL, not `rate()`.
      `# HELP ai_calls_24h Total AI calls by tier over the last 24 hours`,
      `# TYPE ai_calls_24h gauge`,
      ...Object.entries(summary.callsByTier).map(
        ([tier, count]) => `ai_calls_24h{tier="${tier}"} ${count}`,
      ),
      `# HELP ai_cache_hit_rate Cache hit rate (0-1)`,
      `# TYPE ai_cache_hit_rate gauge`,
      `ai_cache_hit_rate ${summary.cacheHitRate}`,
    ];
    void reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return reply.send(lines.join('\n') + '\n');
  });
}
