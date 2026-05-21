import type { DomainEvent } from '@gtarp/event-schema';
import type { Job } from 'bullmq';
import { getPrisma, type PrismaClient } from '@gtarp/db';
import { registerConsumer, type ConsumerRegistration } from '../../bridge/registry.js';
import { scoreEvent, type ReputationDelta } from './scoring.js';

/**
 * Atomic upsert of a single reputation delta.
 *
 * Backed by the `Reputation_target_axis_uniq` composite unique index
 * (NULLS NOT DISTINCT) created in 20260521000000_reputation_add_axis.
 * `INSERT … ON CONFLICT DO UPDATE` is atomic, so concurrent workers writing
 * to the same target+axis tuple cannot create duplicate rows.
 */
async function applyDelta(prisma: PrismaClient, delta: ReputationDelta): Promise<void> {
  const playerId = delta.playerId ?? null;
  const gangId = delta.gangId ?? null;
  const familyId = delta.familyId ?? null;
  const area = delta.area ?? null;
  const businessId = delta.businessId ?? null;
  const axis = delta.axis ?? null;

  await prisma.$executeRaw`
    INSERT INTO "Reputation" ("id", "playerId", "gangId", "familyId", "area", "businessId", "axis", "score", "updatedAt")
    VALUES (gen_random_uuid(), ${playerId}, ${gangId}, ${familyId}, ${area}, ${businessId}, ${axis}, ${delta.delta}, NOW())
    ON CONFLICT ("playerId", "gangId", "familyId", "area", "businessId", "axis")
    DO UPDATE SET
      "score" = "Reputation"."score" + EXCLUDED."score",
      "updatedAt" = NOW()
  `;
}

/**
 * Applies all reputation deltas for a domain event to the database.
 * Exported for direct use in integration tests.
 */
export async function applyReputationDeltas(
  prisma: PrismaClient,
  event: DomainEvent,
): Promise<void> {
  const baseDeltas = scoreEvent(event);
  const extraDeltas: ReputationDelta[] = [];

  // crime.committed serious: +10 per gang that each perp belongs to.
  if (event.type === 'crime.committed' && event.data.severity === 'serious') {
    const memberships = await prisma.gangMembership.findMany({
      where: { playerId: { in: event.data.perpetrators }, leftAt: null },
      select: { gangId: true },
    });
    // Deduplicate gang ids so the same gang only gets +10 once per event.
    const gangIds = [...new Set(memberships.map((m) => m.gangId))];
    for (const gangId of gangIds) {
      extraDeltas.push({ gangId, delta: 10 });
    }
  }

  // business.robbed: +cashTaken/1000 (capped at 50) to each perpetrator's notoriety.
  if (event.type === 'business.robbed') {
    const perps = await prisma.crimePerpetrator.findMany({
      where: { crimeId: event.data.crimeId },
      select: { playerId: true },
    });
    const bonus = Math.min(event.data.cashTaken / 1000, 50);
    if (bonus > 0) {
      for (const { playerId } of perps) {
        extraDeltas.push({ playerId, delta: bonus });
      }
    }
  }

  // Apply sequentially: parallel writes to the same (target, axis) conflict
  // slot from one event would still resolve correctly thanks to the unique
  // index, but serial keeps the on-conflict path quiet and ordering
  // deterministic for test assertions. N per event is small.
  for (const d of [...baseDeltas, ...extraDeltas]) {
    await applyDelta(prisma, d);
  }
}

export const reputationConsumer: ConsumerRegistration = {
  name: 'reputation',
  subjects: [
    'gtarp.crime.committed',
    'gtarp.arrest.made',
    'gtarp.bribe.accepted',
    'gtarp.territory.lost',
    'gtarp.business.robbed',
    'gtarp.phara.activity',
  ],
  handler: async (job: Job<DomainEvent>) => {
    await applyReputationDeltas(getPrisma(), job.data);
  },
};

export function registerReputationEngine(): void {
  registerConsumer(reputationConsumer);
}
