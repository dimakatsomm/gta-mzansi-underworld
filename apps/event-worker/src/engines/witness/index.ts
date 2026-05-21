import { createHash, randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { WitnessObserved, DomainEvent, PharaActivity } from '@gtarp/event-schema';
import type { EventBus } from '@gtarp/event-bus';
import type { Job } from 'bullmq';
import { registerConsumer, type ConsumerRegistration } from '../../bridge/registry.js';

/** SA-authentic Tier 0 witness statement templates by reliability band. */
const STATEMENT_TEMPLATES: Record<string, string[]> = {
  high: [
    'I saw everything, I swear. {description} ran out and jumped into {vehicleColor} {vehicleType}. I saw their face clear — about {height}, {build} build.',
    'Yho, it was hectic. {description} — they had something in their hand, could be a firearm. Ran towards {direction}.',
    'I can tell you exactly what happened. {description} came in fast, grabbed what they could, then bolted. I was standing right there, my G.',
  ],
  medium: [
    'I think I saw something — {description}, maybe? It happened so fast, bra. They went that way, I think.',
    "Eish, it was dark but I saw someone. Could be {description}. I'm not a hundred percent, ne.",
    "I was across the street. {description} — they moved fast, I couldn't see everything clearly.",
  ],
  low: [
    "I don't know, I just heard noise. Maybe {description}? I'm not sure of anything, my bru.",
    "Haai, I wasn't paying attention properly. Something happened, someone ran, that's all I can say.",
    "Look, I don't want trouble. I saw something but I can't be certain what it was.",
  ],
};

const DIRECTIONS = ['north', 'south', 'east', 'west', 'towards the highway', 'into the alley'];
const HEIGHTS = ['short', 'medium height', 'tall'];
const BUILDS = ['slim', 'average', 'stocky'];
const VEHICLE_TYPES = ['sedan', 'hatchback', 'bakkie', 'SUV'];
const COLOURS_EN = ['white', 'black', 'silver', 'red', 'blue', 'dark grey'];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function buildPharaWitnessId(pharaRef: string, activityId: string): string {
  const base = pharaRef.trim().length > 0 ? pharaRef : activityId;
  const digest = createHash('sha256').update(base).digest('hex').slice(0, 12);
  return `phara-${digest}`;
}

/**
 * Generate a quality-adjusted SA-authentic witness statement (Tier 0 template).
 * Returns null if quality is so low that the witness refuses to speak.
 */
export function buildWitnessStatement(
  witnessId: string,
  crimeId: string,
  quality: number,
  factors: WitnessObserved['data']['factors'],
): { statement: string; reliability: number; willing: boolean } | null {
  // Witnesses who are very fearful/intoxicated may refuse
  const willing = quality > 0.15 && !factors.intoxicated;
  if (!willing && quality < 0.1) return null;

  // Map quality to reliability band
  const band: string = quality >= 0.65 ? 'high' : quality >= 0.35 ? 'medium' : 'low';

  const seed = strHash(witnessId + crimeId);
  const tmpl = pick(STATEMENT_TEMPLATES[band]!, seed);

  // Substitute placeholders
  const description = `${pick(HEIGHTS, seed + 1)} ${pick(BUILDS, seed + 2)} person`;
  const statement = tmpl
    .replace('{description}', description)
    .replace('{vehicleColor}', pick(COLOURS_EN, seed + 3))
    .replace('{vehicleType}', pick(VEHICLE_TYPES, seed + 4))
    .replace('{direction}', pick(DIRECTIONS, seed + 5))
    .replace('{height}', pick(HEIGHTS, seed + 6))
    .replace('{build}', pick(BUILDS, seed + 7));

  // Reliability is reduced by fear, intoxication, and distance
  const distancePenalty = Math.min(factors.distance / 100, 0.4);
  const fearPenalty = factors.fear * 0.2;
  const intoxPenalty = factors.intoxicated ? 0.3 : 0;
  const reliability = Math.max(0, quality - distancePenalty - fearPenalty - intoxPenalty);

  return { statement, reliability, willing };
}

// ── Engine ────────────────────────────────────────────────────────────────────

interface WitnessEngineDeps {
  redis: Redis;
  bus: EventBus;
}

let _deps: WitnessEngineDeps | undefined;

export function initWitnessEngine(deps: WitnessEngineDeps): void {
  _deps = deps;
}

const WITNESS_CLAIM_TTL = 60 * 60 * 4; // 4h — witness statements are ephemeral

async function handleWitnessObserved(evt: WitnessObserved): Promise<void> {
  if (!_deps) {
    console.warn('[witness] engine not initialised — skipping');
    return;
  }

  const { redis, bus } = _deps;
  const { crimeId, witnessId, quality, factors } = evt.data;

  // Idempotency: one statement per witness per crime
  const claimKey = `witness:statement:${crimeId}:${witnessId}`;
  const claimed = await redis.set(claimKey, '1', 'EX', WITNESS_CLAIM_TTL, 'NX');
  if (claimed !== 'OK') {
    console.log(`[witness] skipping duplicate witnessId=${witnessId} crimeId=${crimeId}`);
    return;
  }

  try {
    const result = buildWitnessStatement(witnessId, crimeId, quality, factors);
    if (!result) {
      console.log(
        `[witness] witnessId=${witnessId} refused to give statement (quality=${quality.toFixed(2)})`,
      );
      return;
    }

    // Unwilling witnesses don't produce a public statement — downstream
    // consumers (investigation, court) only act on testimony the witness will
    // actually give. Emitting a `willing: false` event leaked noise into the
    // statement stream and inflated reliability metrics.
    if (!result.willing) {
      console.log(
        `[witness] witnessId=${witnessId} unwilling to testify (quality=${quality.toFixed(2)}) — not publishing`,
      );
      return;
    }

    await bus.publish({
      id: randomUUID(),
      type: 'witness.statement',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: evt.id,
      data: {
        crimeId,
        witnessId,
        statement: result.statement,
        reliability: result.reliability,
        willing: result.willing,
      },
    });

    console.log(
      `[witness] published witness.statement crimeId=${crimeId} witnessId=${witnessId} reliability=${result.reliability.toFixed(2)}`,
    );
  } catch (err) {
    // Release the idempotency claim so a retry/redelivery can attempt the
    // statement again. Without this, a transient publish/template failure
    // would block this (crime, witness) pair for the full 4h TTL.
    await redis.del(claimKey).catch((delErr) => {
      console.warn(`[witness] failed to release claim ${claimKey} after error`, delErr);
    });
    throw err;
  }
}

export { handleWitnessObserved };

/**
 * Inject a low-quality `witness.observed` event when a phara reports a mugging
 * or dealing_proximity activity. Pharas are always intoxicated, so quality is
 * below the willing threshold — they contribute noise rather than actionable
 * testimony, which is intentional.
 */
async function handlePharaActivity(evt: PharaActivity): Promise<void> {
  if (!_deps) {
    console.warn('[witness] engine not initialised — skipping phara injection');
    return;
  }
  const { activityType, pharaRef, activityId } = evt.data;
  // Only inject for activities where the phara directly observed a crime scene.
  if (activityType !== 'mugging' && activityType !== 'dealing_proximity') return;

  const { bus } = _deps;
  const witnessId = buildPharaWitnessId(pharaRef, activityId);

  // mugging=0.12 (below 0.15 willing threshold — present but useless as witness)
  // dealing_proximity=0.18 (marginally above, but intoxication penalty reduces effective reliability to ~0)
  const quality = activityType === 'mugging' ? 0.12 : 0.18;

  await bus.publish({
    id: randomUUID(),
    type: 'witness.observed',
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId: evt.id,
    data: {
      crimeId: activityId,
      witnessId: witnessId,
      quality: quality,
      factors: {
        lighting: 0.5,
        distance: 1.5,
        fear: 0.6,
        intimidated: false,
        intoxicated: true,
        relationshipToSuspect: 'stranger',
      },
    },
  });
  console.log(
    `[witness] injected phara witness.observed activityType=${activityType} pharaRef=${pharaRef}`,
  );
}

export const witnessConsumer: ConsumerRegistration = {
  name: 'witness',
  subjects: ['gtarp.witness.observed', 'gtarp.phara.activity'],
  handler: async (job: Job<DomainEvent>) => {
    if (job.data.type === 'witness.observed') {
      await handleWitnessObserved(job.data as WitnessObserved);
    } else if (job.data.type === 'phara.activity') {
      await handlePharaActivity(job.data as PharaActivity);
    }
  },
};

export function registerWitnessEngine(): void {
  registerConsumer(witnessConsumer);
}
