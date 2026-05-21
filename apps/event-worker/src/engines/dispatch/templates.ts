import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLANG,
  SURNAMES,
  FIRST_NAMES,
  CONVENIENCE_STORES,
  VEHICLE_COLORS,
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

/** Resolve absolute path to the sa-content templates directory. */
function templatesDir(): string {
  // Walk up from this file: apps/event-worker/src/engines/dispatch
  // → packages/sa-content/src/templates/dispatch
  const thisDir = fileURLToPath(new URL('.', import.meta.url));
  return resolve(thisDir, '../../../../../packages/sa-content/src/templates/dispatch');
}

let _cache: Map<string, string> | undefined;

function loadTemplates(): Map<string, string> {
  if (_cache) return _cache;
  const dir = templatesDir();
  const map = new Map<string, string>();
  for (let i = 1; i <= 10; i++) {
    const id = String(i).padStart(3, '0');
    try {
      const content = readFileSync(resolve(dir, `${id}.tmpl`), 'utf8').trim();
      map.set(id, content);
    } catch {
      // template file missing — skip
    }
  }
  _cache = map;
  return _cache;
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
  const raw = templates.get(templateId);
  if (!raw) return null;

  // Apply placeholder substitutions using seeded RNG for determinism
  const casual = SLANG.filter((s) => s.register === 'casual');
  const street = SLANG.filter((s) => s.register === 'street');

  return raw
    .replace(/\{\{slang\.casual\}\}/g, () => pickFrom(casual, rng).term)
    .replace(/\{\{slang\.street\}\}/g, () => pickFrom(street, rng).term)
    .replace(/\{\{slang\.tsotsitaal\}\}/g, () => pickFrom(SLANG, rng).term)
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
