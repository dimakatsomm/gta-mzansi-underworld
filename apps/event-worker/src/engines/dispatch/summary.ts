import type { Redis } from 'ioredis';
import type { CrimeCommitted } from '@gtarp/event-schema';
import { buildTier0Summary, buildSuspectDescription } from './templates.js';

const IDEMPOTENT_TTL_SEC = 60 * 60 * 24; // 24 hours

export interface SummaryResult {
  summary: string;
  tier: 0 | 1;
  cached: boolean;
}

/** Redis key for dispatch idempotency — cache key includes crimeId per ADR-0004. */
export function dispatchCacheKey(crimeId: string): string {
  return `dispatch:summary:${crimeId}`;
}

/**
 * Generate (or retrieve cached) dispatch summary for a `crime.committed` event.
 *
 * Strategy:
 *   1. Check Redis for existing summary (idempotency — same crimeId → same text).
 *   2. Try Tier 0 template. If templates cover the severity bucket → done.
 *   3. Tier 1 fallback: call ai-orchestrator POST /generate/text with Haiku-class model.
 *      Falls back to a minimal canned response if orchestrator is unreachable (501/network).
 *   4. Store result in Redis with 24 h TTL.
 */
export async function generateDispatchSummary(
  event: CrimeCommitted,
  redis: Redis,
  orchestratorUrl: string,
): Promise<SummaryResult> {
  const key = dispatchCacheKey(event.data.crimeId);

  // 1 — idempotency check. Cache stores `{tier,summary}` JSON so the original
  // tier survives retries (Grafana Tier-0 dominance would skew otherwise).
  // Legacy plain-string entries are still accepted and assumed tier 0.
  const cached = await redis.get(key);
  if (cached) {
    const parsed = tryParseCached(cached);
    if (parsed) {
      return { summary: parsed.summary, tier: parsed.tier, cached: true };
    }
    return { summary: cached, tier: 0, cached: true };
  }

  // 2 — Tier 0 template
  const tier0 = buildTier0Summary(event);
  if (tier0 !== null) {
    await writeCached(redis, key, { summary: tier0, tier: 0 });
    return { summary: tier0, tier: 0, cached: false };
  }

  // 3 — Tier 1 fallback (novel severity bucket with no template)
  const suspectDesc = buildSuspectDescription(event);
  const tier1 = await callTier1(event, suspectDesc, orchestratorUrl);
  await writeCached(redis, key, { summary: tier1, tier: 1 });
  return { summary: tier1, tier: 1, cached: false };
}

interface CachedSummary {
  summary: string;
  tier: 0 | 1;
}

function tryParseCached(raw: string): CachedSummary | null {
  if (!raw.startsWith('{')) return null;
  try {
    const obj = JSON.parse(raw) as Partial<CachedSummary>;
    if (typeof obj?.summary === 'string' && (obj.tier === 0 || obj.tier === 1)) {
      return { summary: obj.summary, tier: obj.tier };
    }
  } catch {
    // fall through — treat as plain string
  }
  return null;
}

async function writeCached(redis: Redis, key: string, value: CachedSummary): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', IDEMPOTENT_TTL_SEC);
}

async function callTier1(
  event: CrimeCommitted,
  suspectDesc: string,
  orchestratorUrl: string,
): Promise<string> {
  const { crimeType, severity, location } = event.data;

  const body = {
    purpose: 'dispatch',
    tier: 1,
    system:
      'You are a PPS (Provincial Police Service) radio dispatcher in eGoli. ' +
      'Speak with professional urgency. SA English, no slang. Keep to 2 sentences max.',
    user: `Crime: ${crimeType.replace(/_/g, ' ')}. Severity: ${severity}. Location: ${location.area}. ${suspectDesc}.`,
    maxTokens: 80,
    temperature: 0.3,
    cacheKey: `dispatch:tier1:${event.data.crimeId}`,
  };

  try {
    const res = await fetch(`${orchestratorUrl}/generate/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const data = (await res.json()) as { text?: string };
      if (data.text) return data.text;
    }
  } catch {
    // orchestrator unreachable — fall through to canned response
  }

  // Canned fallback (Tier 0-equivalent) — never fail dispatch
  return `All units — ${crimeType.replace(/_/g, ' ')} reported in ${location.area}. ${suspectDesc}. Respond code blue.`;
}
