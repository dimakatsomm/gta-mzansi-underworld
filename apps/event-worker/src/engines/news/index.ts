import type { Redis } from 'ioredis';
import type { DomainEvent, DispatchRequested } from '@gtarp/event-schema';
import type { Job } from 'bullmq';
import { getPrisma } from '@gtarp/db';
import { NEWS_HEADLINE_TEMPLATES, SLANG, SURNAMES, FIRST_NAMES } from '@gtarp/sa-content';
import { registerConsumer, type ConsumerRegistration } from '../../bridge/registry.js';

interface NewsEngineDeps {
  redis: Redis;
}

let _deps: NewsEngineDeps | undefined;

export function initNewsEngine(deps: NewsEngineDeps): void {
  _deps = deps;
}

export function _resetNewsEngineForTests(): void {
  _deps = undefined;
}

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

const TEMPLATE_CATEGORY: Record<string, string> = {
  '001': 'crime',
  '002': 'business',
  '003': 'crime',
  '004': 'crime',
  '005': 'politics',
};

const NEWS_IDEMPOTENCY_TTL_SEC = 60 * 60 * 24; // 24 hours

function newsCacheKey(incidentId: string): string {
  return `news:incident:${incidentId}`;
}

function buildHeadline(incidentId: string): { headline: string; category: string } {
  const rng = mulberry32(strToSeed(incidentId));
  const ids = Object.keys(NEWS_HEADLINE_TEMPLATES);
  const templateId = pickFrom(ids, rng);
  const raw = NEWS_HEADLINE_TEMPLATES[templateId] as string;

  const casual = SLANG.filter((s) => s.register === 'casual');
  const safe = <T>(arr: readonly T[], fallback: readonly T[]): readonly T[] =>
    arr.length > 0 ? arr : fallback;

  const headline = raw
    .replace(/\{\{name\.given\.m\}\}/g, () => pickFrom(FIRST_NAMES.m, rng))
    .replace(/\{\{name\.given\.f\}\}/g, () => pickFrom(FIRST_NAMES.f, rng))
    .replace(/\{\{name\.surname\}\}/g, () => pickFrom(SURNAMES, rng))
    .replace(/\{\{slang\.casual\}\}/g, () => pickFrom(safe(casual, SLANG), rng).term);

  const category = TEMPLATE_CATEGORY[templateId] ?? 'crime';
  return { headline, category };
}

async function handleDispatchRequested(event: DispatchRequested): Promise<void> {
  if (!_deps) {
    console.warn('[news] engine not initialised — skipping');
    return;
  }

  const { redis } = _deps;
  const { incidentId, location } = event.data;

  const claimed = await redis.set(
    newsCacheKey(incidentId),
    '1',
    'EX',
    NEWS_IDEMPOTENCY_TTL_SEC,
    'NX',
  );
  if (claimed !== 'OK') {
    console.log(`[news] skipping incidentId=${incidentId} — already processed`);
    return;
  }

  try {
    const { headline, category } = buildHeadline(incidentId);

    const prisma = getPrisma();
    await prisma.newsEvent.create({
      data: {
        headline,
        body: headline,
        category,
        province: location.province ?? null,
        area: location.area ?? null,
        sourceEventIds: [event.id],
      },
    });

    console.log(`[news] created NewsEvent for incidentId=${incidentId} category=${category}`);
  } catch (err) {
    await redis.del(newsCacheKey(incidentId)).catch(() => {
      /* best-effort */
    });
    throw err;
  }
}

export const newsConsumer: ConsumerRegistration = {
  name: 'media',
  subjects: ['gtarp.dispatch.requested'],
  handler: async (job: Job<DomainEvent>) => {
    if (job.data.type !== 'dispatch.requested') return;
    await handleDispatchRequested(job.data as DispatchRequested);
  },
};

export function registerNewsEngine(): void {
  registerConsumer(newsConsumer);
}
