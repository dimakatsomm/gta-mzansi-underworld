import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { DomainEvent, CrimeCommitted } from '@gtarp/event-schema';
import type { Job } from 'bullmq';
import type { EventBus } from '@gtarp/event-bus';
import { DISPATCH_VOICE_ID } from '@gtarp/sa-content';
import { registerConsumer, type ConsumerRegistration } from '../../bridge/registry.js';
import { generateDispatchSummary, dispatchCacheKey } from './summary.js';

const VOICE_CACHE_TTL_SEC = 60 * 60 * 24 * 7; // 7 days — audio is expensive

/** Redis key for the voice URL cache. crimeId in key per ADR-0004. */
function voiceCacheKey(crimeId: string): string {
  return `dispatch:voice:${crimeId}`;
}

/** Redis key for the published incidentId — prevents double-publishing. */
function incidentKey(crimeId: string): string {
  return `dispatch:incident:${crimeId}`;
}

interface DispatchEngineDeps {
  redis: Redis;
  orchestratorUrl: string;
  /** Long-lived EventBus — connect once at startup, reuse across all crimes. */
  bus: EventBus;
}

let _deps: DispatchEngineDeps | undefined;

export function initDispatchEngine(deps: DispatchEngineDeps): void {
  _deps = deps;
}

/** Reset internal state — tests only. */
export function _resetDispatchEngineForTests(): void {
  _deps = undefined;
}

/** TTL (seconds) for the atomic dispatch claim. Matches summary cache. */
const INCIDENT_CLAIM_TTL_SEC = 60 * 60 * 24;

async function handleCrimeCommitted(event: CrimeCommitted): Promise<void> {
  if (!_deps) {
    console.warn('[dispatch] engine not initialised — skipping');
    return;
  }

  const { redis, orchestratorUrl, bus } = _deps;
  const { crimeId, severity, location } = event.data;

  // Atomic idempotency claim: SET NX guarantees exactly one worker proceeds
  // per crimeId even under concurrent delivery. Value is the new incidentId so
  // subsequent racers can log what won.
  const incidentId = randomUUID();
  const claimed = await redis.set(
    incidentKey(crimeId),
    incidentId,
    'EX',
    INCIDENT_CLAIM_TTL_SEC,
    'NX',
  );
  if (claimed !== 'OK') {
    const existingIncidentId = await redis.get(incidentKey(crimeId));
    console.log(
      `[dispatch] skipping crimeId=${crimeId} — already dispatched as ${existingIncidentId ?? '<unknown>'}`,
    );
    return;
  }

  // Wrap ALL post-claim work in try/catch so the claim is released on any
  // failure (summary generation, voice synth, bus publish). Otherwise a
  // transient failure would lock the crimeId out of retry for the full TTL.
  let publishedOk = false;
  try {
    // 1 — Generate (or retrieve cached) summary
    const {
      summary,
      tier,
      cached: summaryCached,
    } = await generateDispatchSummary(event, redis, orchestratorUrl);
    console.log(`[dispatch] summary tier=${tier} cached=${summaryCached} crimeId=${crimeId}`);

    // 2 — Voice synthesis via ai-orchestrator (Tier 1 via ElevenLabs, budget-guarded).
    //     Cache key includes crimeId so retries hit. Gracefully skip on failure.
    let voiceUrl: string | undefined;
    const voiceKey = voiceCacheKey(crimeId);

    const cachedVoice = await redis.get(voiceKey);
    if (cachedVoice) {
      voiceUrl = cachedVoice;
    } else {
      voiceUrl = await requestVoiceSynth(summary, crimeId, orchestratorUrl);
      if (voiceUrl) {
        await redis.set(voiceKey, voiceUrl, 'EX', VOICE_CACHE_TTL_SEC);
      }
    }

    // 3 — Publish dispatch.requested on the shared bus connection.
    await bus.publish({
      id: randomUUID(),
      type: 'dispatch.requested',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: event.id,
      data: {
        incidentId,
        severity,
        location,
        summary,
        ...(voiceUrl ? { voiceUrl } : {}),
      },
    });
    publishedOk = true;

    // 4 — Align claim TTL with summary cache so they expire together.
    const summaryTtl = await redis.ttl(dispatchCacheKey(crimeId));
    if (summaryTtl > 0 && summaryTtl !== INCIDENT_CLAIM_TTL_SEC) {
      await redis.expire(incidentKey(crimeId), summaryTtl);
    }

    console.log(
      `[dispatch] published dispatch.requested incidentId=${incidentId} crimeId=${crimeId}`,
    );
  } finally {
    if (!publishedOk) {
      // Best-effort release of the atomic claim — a retry can then succeed.
      await redis.del(incidentKey(crimeId)).catch(() => {
        /* best-effort */
      });
    }
  }
}

async function requestVoiceSynth(
  text: string,
  crimeId: string,
  orchestratorUrl: string,
): Promise<string | undefined> {
  const voiceId = process.env['ELEVENLABS_DISPATCH_VOICE_ID'] ?? DISPATCH_VOICE_ID;
  const body = {
    voiceId,
    text,
    purpose: 'dispatch',
    cacheKey: `dispatch:voice:${crimeId}`,
  };

  try {
    const res = await fetch(`${orchestratorUrl}/generate/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = (await res.json()) as { url?: string };
      return data.url;
    }

    if (res.status === 501) {
      // Orchestrator voice synthesis not yet wired — silently skip, non-blocking.
      return undefined;
    }

    console.warn(`[dispatch] voice synth failed: ${res.status}`);
  } catch (err) {
    console.warn('[dispatch] voice synth unreachable:', err);
  }

  return undefined;
}

export const dispatchConsumer: ConsumerRegistration = {
  name: 'dispatch',
  subjects: ['gtarp.crime.committed'],
  handler: async (job: Job<DomainEvent>) => {
    if (job.data.type !== 'crime.committed') return;
    await handleCrimeCommitted(job.data as CrimeCommitted);
  },
};

export function registerDispatchEngine(): void {
  registerConsumer(dispatchConsumer);
}
