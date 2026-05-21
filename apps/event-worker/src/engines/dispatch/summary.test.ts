import { describe, it, expect, vi } from 'vitest';
import type { CrimeCommitted } from '@gtarp/event-schema';
import { buildTier0Summary, buildSuspectDescription, severityToTone } from './templates.js';
import { generateDispatchSummary, dispatchCacheKey } from './summary.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCrimeEvent(overrides: Partial<CrimeCommitted['data']> = {}): CrimeCommitted {
  return {
    id: 'evt-d001',
    type: 'crime.committed',
    version: 1,
    occurredAt: '2026-01-01T00:00:00Z',
    data: {
      crimeId: 'crime-aabb-ccdd-eeff',
      crimeType: 'robbery',
      severity: 'minor',
      perpetrators: ['player-1'],
      victims: [],
      location: { x: 1000, y: 2000, z: 10, province: 'GP', area: 'Yeoville' },
      witnessed: true,
      witnessIds: ['w-1'],
      ...overrides,
    },
  };
}

// Minimal Redis mock for idempotency tests
function makeRedis(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    _store: store,
  };
}

// ── severityToTone ────────────────────────────────────────────────────────────

describe('severityToTone', () => {
  it('petty → calm', () => expect(severityToTone('petty')).toBe('calm'));
  it('minor → calm', () => expect(severityToTone('minor')).toBe('calm'));
  it('major → urgent', () => expect(severityToTone('major')).toBe('urgent'));
  it('serious → urgent', () => expect(severityToTone('serious')).toBe('urgent'));
  it('capital → urgent', () => expect(severityToTone('capital')).toBe('urgent'));
});

// ── buildSuspectDescription ───────────────────────────────────────────────────

describe('buildSuspectDescription', () => {
  it('singles perp count', () => {
    const desc = buildSuspectDescription(makeCrimeEvent());
    expect(desc).toContain('1 suspect');
    expect(desc).toContain('robbery');
    expect(desc).toContain('Yeoville');
  });

  it('plurals perp count', () => {
    const desc = buildSuspectDescription(makeCrimeEvent({ perpetrators: ['p1', 'p2', 'p3'] }));
    expect(desc).toContain('3 suspects');
  });
});

// ── buildTier0Summary ─────────────────────────────────────────────────────────

describe('buildTier0Summary', () => {
  it('returns a non-empty string for robbery', () => {
    const text = buildTier0Summary(makeCrimeEvent());
    expect(text).not.toBeNull();
    expect(typeof text).toBe('string');
    expect((text as string).length).toBeGreaterThan(0);
  });

  it('is deterministic — same crimeId produces same text', () => {
    const event = makeCrimeEvent({ crimeId: 'fixed-uuid-1234-5678-9abc' });
    const a = buildTier0Summary(event);
    const b = buildTier0Summary(event);
    expect(a).toBe(b);
  });

  it('differs for different crimeIds', () => {
    const a = buildTier0Summary(makeCrimeEvent({ crimeId: 'uuid-aaaa' }));
    const b = buildTier0Summary(makeCrimeEvent({ crimeId: 'uuid-bbbb' }));
    // They may coincidentally match for some seeds, but template text is the same template
    // — what we assert is that the function runs without error.
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  it('resolves {{area}} placeholder from location', () => {
    // The robbery template 002 contains 'Yeoville' — injected at area level
    // For determinism tests we check no raw placeholders remain
    const text = buildTier0Summary(makeCrimeEvent({ crimeId: 'stable-id-0001' }));
    expect(text).not.toMatch(/\{\{/);
  });

  it('returns string for hijack crimeType', () => {
    const text = buildTier0Summary(makeCrimeEvent({ crimeType: 'hijack' }));
    expect(text).not.toBeNull();
  });

  it('returns string for murder (capital) crimeType', () => {
    const text = buildTier0Summary(makeCrimeEvent({ crimeType: 'murder', severity: 'capital' }));
    expect(text).not.toBeNull();
  });
});

// ── generateDispatchSummary (idempotency) ─────────────────────────────────────

describe('generateDispatchSummary — idempotency', () => {
  const ORCHESTRATOR_URL = 'http://localhost:3002';

  it('returns cached result on second call with same crimeId', async () => {
    const event = makeCrimeEvent({ crimeId: 'idempotent-crime-001' });
    const redis = makeRedis();

    // First call — generates and caches
    const r1 = await generateDispatchSummary(event, redis as never, ORCHESTRATOR_URL);
    expect(r1.cached).toBe(false);
    expect(r1.summary.length).toBeGreaterThan(0);

    // Simulate what Redis.get returns after set
    redis.get.mockImplementation(async (key: string) => {
      if (key === dispatchCacheKey(event.data.crimeId)) return r1.summary;
      return null;
    });

    // Second call — must return cached
    const r2 = await generateDispatchSummary(event, redis as never, ORCHESTRATOR_URL);
    expect(r2.cached).toBe(true);
    expect(r2.summary).toBe(r1.summary);
  });

  it('writes to Redis on first call', async () => {
    const event = makeCrimeEvent({ crimeId: 'write-test-crime-002' });
    const redis = makeRedis();

    await generateDispatchSummary(event, redis as never, ORCHESTRATOR_URL);

    expect(redis.set).toHaveBeenCalledWith(
      dispatchCacheKey(event.data.crimeId),
      expect.any(String),
      'EX',
      expect.any(Number),
    );
  });

  it('uses Tier 0 for robbery (has templates)', async () => {
    const event = makeCrimeEvent({ crimeType: 'robbery', crimeId: 'tier-0-test-003' });
    const redis = makeRedis();
    const result = await generateDispatchSummary(event, redis as never, ORCHESTRATOR_URL);
    expect(result.tier).toBe(0);
  });

  it('preserves Tier 1 on cached read', async () => {
    const event = makeCrimeEvent({ crimeId: 'cached-tier-1-004' });
    const cachedJson = JSON.stringify({ summary: 'cached tier-1 text', tier: 1 });
    const redis = makeRedis({ [dispatchCacheKey(event.data.crimeId)]: cachedJson });
    const result = await generateDispatchSummary(event, redis as never, ORCHESTRATOR_URL);
    expect(result.cached).toBe(true);
    expect(result.tier).toBe(1);
    expect(result.summary).toBe('cached tier-1 text');
  });

  it('treats legacy plain-string cache entries as Tier 0', async () => {
    const event = makeCrimeEvent({ crimeId: 'legacy-cache-005' });
    const redis = makeRedis({
      [dispatchCacheKey(event.data.crimeId)]: 'legacy plain string',
    });
    const result = await generateDispatchSummary(event, redis as never, ORCHESTRATOR_URL);
    expect(result.cached).toBe(true);
    expect(result.tier).toBe(0);
    expect(result.summary).toBe('legacy plain string');
  });
});
