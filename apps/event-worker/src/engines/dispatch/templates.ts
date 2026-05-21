import {
  SLANG,
  SURNAMES,
  FIRST_NAMES,
  CONVENIENCE_STORES,
  VEHICLE_COLORS,
  DISPATCH_TEMPLATES,
} from '@gtarp/sa-content';
import type { CrimeCommitted } from '@gtarp/event-schema';

// Severity buckets for dispatch tone
export type DispatchTone = 'calm' | 'urgent';

export function severityToTone(severity: CrimeCommitted['data']['severity']): DispatchTone {
  return severity === 'petty' || severity === 'minor' ? 'calm' : 'urgent';
}

/**
 * Maps (crimeType, severity) to the dispatch template IDs from sa-content.
 * Keys: `<crimeType>` or `<crimeType>:<severity>` (more specific wins).
 * Fall back to 'robbery' templates when no match.
 */
const TEMPLATE_POOL: Record<string, readonly string[]> = {
  hijack: ['001', '007'],
  robbery: ['002'],
  cit_robbery: ['005'],
  drug_deal: ['006'],
  assault: ['004', '008'],
  murder: ['003'],
  firearm_trafficking: ['004', '009'],
  smuggling: ['009'],
  corruption_bribe: ['006'],
  counterfeit: ['006'],
  tender_fraud: ['006'],
  protection: ['002', '004'],
  money_laundering: ['006'],
  // No template → caller must escalate to Tier 1
};

const FALLBACK_POOL: readonly string[] = ['002', '004'];

/** Templates ship inlined inside `@gtarp/sa-content` — no fs reads at runtime. */
function loadTemplates(): Record<string, string> {
  return DISPATCH_TEMPLATES;
}

// Seeded PRNG (mulberry32) — deterministic on crimeId
function mulberry32(seed: number): () => number {
  return () => {
    let s = (seed += 0x6d2b79f5);
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function strToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickFrom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

/**
 * Returns the Tier 0 dispatch summary for the given crime event.
 * Returns `null` when no template is available for the severity bucket (Tier 1 fallback needed).
 *
 * Deterministic: same crimeId always produces the same text.
 */
export function buildTier0Summary(event: CrimeCommitted): string | null {
  const templates = loadTemplates();
  const crimeType = event.data.crimeType;
  const pool = TEMPLATE_POOL[crimeType] ?? FALLBACK_POOL;

  const rng = mulberry32(strToSeed(event.data.crimeId));
  const templateId = pickFrom(pool, rng);
  const raw = templates[templateId];
  if (!raw) return null;

  // Apply placeholder substitutions using seeded RNG for determinism
  const casual = SLANG.filter((s) => s.register === 'casual');
  const street = SLANG.filter((s) => s.register === 'street');
  const tsotsitaal = SLANG.filter((s) => s.register === 'tsotsitaal');
  // Fall back to the full SLANG list if a register happens to be empty so
  // pickFrom() never sees a zero-length array.
  const safe = <T>(arr: readonly T[], fallback: readonly T[]): readonly T[] =>
    arr.length > 0 ? arr : fallback;

  return raw
    .replace(/\{\{slang\.casual\}\}/g, () => pickFrom(safe(casual, SLANG), rng).term)
    .replace(/\{\{slang\.street\}\}/g, () => pickFrom(safe(street, SLANG), rng).term)
    .replace(/\{\{slang\.tsotsitaal\}\}/g, () => pickFrom(safe(tsotsitaal, SLANG), rng).term)
    .replace(/\{\{name\.given\.m\}\}/g, () => pickFrom(FIRST_NAMES.m, rng))
    .replace(/\{\{name\.given\.f\}\}/g, () => pickFrom(FIRST_NAMES.f, rng))
    .replace(/\{\{name\.surname\}\}/g, () => pickFrom(SURNAMES, rng))
    .replace(/\{\{area\}\}/g, event.data.location.area)
    .replace(/\{\{store\}\}/g, () => pickFrom(CONVENIENCE_STORES, rng))
    .replace(/\{\{vehicle\.color\}\}/g, () => pickFrom(VEHICLE_COLORS, rng));
}

/** Build a human-readable suspect description from the crime payload. */
export function buildSuspectDescription(event: CrimeCommitted): string {
  const { perpetrators, crimeType, location } = event.data;
  const count = perpetrators.length;
  const noun = count === 1 ? 'suspect' : 'suspects';
  return `${count} ${noun} — ${crimeType.replace(/_/g, ' ')} — ${location.area}`;
}

export { TEMPLATE_POOL };
