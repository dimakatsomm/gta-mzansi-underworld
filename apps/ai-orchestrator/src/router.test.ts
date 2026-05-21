import { describe, it, expect, vi } from 'vitest';
import { routeText } from './router.js';
import type { RouterDeps, BudgetChecker, UsageLogger } from './router.js';
import type { GenerationRequest, GenerationResult, TextProvider } from '@gtarp/ai-clients';
import type { AiTier } from '@gtarp/shared-types';

function makeResult(tier: AiTier): GenerationResult {
  return {
    text: 'Eish, sharp response.',
    provider: tier === 0 ? 'template' : 'anthropic',
    model: tier === 0 ? 'template-v1' : 'claude-haiku-4-5-20251001',
    tier,
    promptTokens: 50,
    completionTokens: 100,
    costUsd: 0.001,
    cacheHit: false,
  };
}

function makeTextProvider(tier: AiTier): TextProvider {
  return { generate: vi.fn(async () => makeResult(tier)) };
}

function makeBudgetChecker(opts?: { serverOk?: boolean; playerOk?: boolean }): BudgetChecker {
  return {
    checkServer: vi.fn(async () => opts?.serverOk ?? true),
    checkPlayer: vi.fn(async () => opts?.playerOk ?? true),
    recordUsage: vi.fn(async () => undefined),
  };
}

function makeUsageLogger(): UsageLogger {
  return { log: vi.fn(async () => undefined) };
}

function makeDeps(
  tiers: AiTier[],
  budgetChecker: BudgetChecker,
  usageLogger: UsageLogger = makeUsageLogger(),
): RouterDeps {
  const textProviders = new Map<AiTier, TextProvider>(tiers.map((t) => [t, makeTextProvider(t)]));
  return {
    textProviders,
    voiceProviders: new Map(),
    budgetChecker,
    usageLogger,
  };
}

const baseReq: GenerationRequest = {
  purpose: 'dispatch',
  tier: 2,
  system: 'You are an eGoli emergency dispatcher.',
  user: 'Describe the hijacking at Hillbrow rank.',
  maxTokens: 512,
};

describe('routeText', () => {
  it('uses requested tier when within budget', async () => {
    const deps = makeDeps([0, 1, 2, 3], makeBudgetChecker());
    const result = await routeText(baseReq, 'player-1', deps);
    expect(result.requestedTier).toBe(2);
    expect(result.usedTier).toBe(2);
    expect(result.degraded).toBe(false);
  });

  it('hard-falls to tier 0 when server budget exceeded', async () => {
    const deps = makeDeps([0, 1, 2, 3], makeBudgetChecker({ serverOk: false, playerOk: true }));
    const result = await routeText(baseReq, undefined, deps);
    expect(result.requestedTier).toBe(2);
    // Stepping 2→1 would still spend paid tokens; only tier 0 (templates) is free.
    expect(result.usedTier).toBe(0);
    expect(result.degraded).toBe(true);
  });

  it('degrades further when both server and player budgets exceeded', async () => {
    const deps = makeDeps([0, 1, 2, 3], makeBudgetChecker({ serverOk: false, playerOk: false }));
    const result = await routeText(baseReq, 'player-1', deps);
    expect(result.usedTier).toBe(0);
    expect(result.degraded).toBe(true);
  });

  it('stays at tier 0 when budget exceeded at tier 0 (unlimited templates)', async () => {
    const req: GenerationRequest = { ...baseReq, tier: 0 };
    const deps = makeDeps([0], makeBudgetChecker({ serverOk: false, playerOk: false }));
    const result = await routeText(req, 'player-1', deps);
    expect(result.usedTier).toBe(0);
  });

  it('returns degraded=false when no degradation occurs', async () => {
    const deps = makeDeps([0, 1, 2], makeBudgetChecker());
    const result = await routeText(baseReq, 'player-1', deps);
    expect(result.degraded).toBe(false);
  });

  it('returns degraded=true after degradation', async () => {
    const deps = makeDeps([0, 1, 2], makeBudgetChecker({ serverOk: false }));
    const result = await routeText(baseReq, undefined, deps);
    expect(result.degraded).toBe(true);
  });

  it('logs usage after generation', async () => {
    const usageLogger = makeUsageLogger();
    const deps = makeDeps([0, 1, 2], makeBudgetChecker(), usageLogger);
    await routeText(baseReq, 'player-1', deps);
    expect(usageLogger.log).toHaveBeenCalledOnce();
    const logged = (usageLogger.log as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(logged).toMatchObject({ purpose: 'dispatch' });
  });

  it('falls back to tier 0 provider when requested tier provider missing', async () => {
    // Only tier 0 and tier 1 providers — request tier 3
    const deps = makeDeps([0, 1], makeBudgetChecker());
    const req: GenerationRequest = { ...baseReq, tier: 3 };
    const result = await routeText(req, undefined, deps);
    // Server budget ok, so effective tier is 3, but provider missing → falls back to tier 0
    expect(result.tier).toBe(0);
  });
});
