import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { createBudgetMiddleware } from './budget.js';
import type { BudgetChecker } from '../router.js';

function makeBudgetChecker(opts?: { serverOk?: boolean; playerOk?: boolean }): BudgetChecker {
  return {
    checkServer: vi.fn(async () => opts?.serverOk ?? true),
    checkPlayer: vi.fn(async () => opts?.playerOk ?? true),
    recordUsage: vi.fn(async () => undefined),
  };
}

async function buildTestApp(budgetChecker: BudgetChecker, _headers: Record<string, string> = {}) {
  const app = Fastify({ logger: false });
  const middleware = createBudgetMiddleware({ budgetChecker });

  app.post('/test', { preHandler: middleware }, async (req, reply) => {
    return reply.send(req.budgetCtx ?? null);
  });

  await app.ready();
  return app;
}

describe('createBudgetMiddleware', () => {
  it('attaches budgetCtx with no degradation when within budget', async () => {
    const checker = makeBudgetChecker({ serverOk: true, playerOk: true });
    const app = await buildTestApp(checker);

    const res = await app.inject({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json', 'x-player-id': 'player-42' },
      payload: { tier: 2 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ effectiveTier: number; playerId: string; degraded: boolean }>();
    expect(body.effectiveTier).toBe(2);
    expect(body.playerId).toBe('player-42');
    expect(body.degraded).toBe(false);
    await app.close();
  });

  it('degrades tier when server budget exceeded', async () => {
    const checker = makeBudgetChecker({ serverOk: false, playerOk: true });
    const app = await buildTestApp(checker);

    const res = await app.inject({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      payload: { tier: 2 },
    });

    const body = res.json<{ effectiveTier: number; degraded: boolean }>();
    // Hard-fallback to tier 0 on budget exceed — stepping 2→1 still spends paid tokens.
    expect(body.effectiveTier).toBe(0);
    expect(body.degraded).toBe(true);
    await app.close();
  });

  it('works without playerId header', async () => {
    const checker = makeBudgetChecker({ serverOk: true });
    const app = await buildTestApp(checker);

    const res = await app.inject({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      payload: { tier: 1 },
    });

    const body = res.json<{ effectiveTier: number; playerId: unknown; degraded: boolean }>();
    expect(body.effectiveTier).toBe(1);
    expect(body.playerId).toBeUndefined();
    expect(body.degraded).toBe(false);
    await app.close();
  });

  it('degraded=true when budget exceeded, degraded=false when not', async () => {
    const notExceeded = makeBudgetChecker({ serverOk: true });
    const app1 = await buildTestApp(notExceeded);
    const res1 = await app1.inject({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      payload: { tier: 1 },
    });
    expect(res1.json<{ degraded: boolean }>().degraded).toBe(false);
    await app1.close();

    const exceeded = makeBudgetChecker({ serverOk: false });
    const app2 = await buildTestApp(exceeded);
    const res2 = await app2.inject({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      payload: { tier: 2 },
    });
    expect(res2.json<{ degraded: boolean }>().degraded).toBe(true);
    await app2.close();
  });
});
