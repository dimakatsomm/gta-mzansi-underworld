import type { DomainEvent } from '@gtarp/event-schema';
import type { Job } from 'bullmq';
import { getPrisma, type PrismaClient } from '@gtarp/db';
import { registerConsumer, type ConsumerRegistration } from '../../bridge/registry.js';
import { scoreEvent, type ReputationDelta } from './scoring.js';

/**
 * Upserts a single reputation delta row.
 * Lookup key: (playerId, gangId, familyId, area, axis) — all nullable.
 * Uses findFirst + update/create to avoid requiring a compound unique index.
 */
async function applyDelta(prisma: PrismaClient, delta: ReputationDelta): Promise<void> {
  const where = {
    playerId: delta.playerId ?? null,
    gangId: delta.gangId ?? null,
    familyId: delta.familyId ?? null,
    area: delta.area ?? null,
    axis: delta.axis ?? null,
  };

  const existing = await prisma.reputation.findFirst({ where });
  if (existing) {
    await prisma.reputation.update({
      where: { id: existing.id },
      data: { score: { increment: delta.delta } },
    });
  } else {
    await prisma.reputation.create({
      data: {
        playerId: delta.playerId ?? null,
        gangId: delta.gangId ?? null,
        familyId: delta.familyId ?? null,
        area: delta.area ?? null,
        axis: delta.axis ?? null,
        score: delta.delta,
      },
    });
  }
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

  const allDeltas = [...baseDeltas, ...extraDeltas];
  await Promise.all(allDeltas.map((d) => applyDelta(prisma, d)));
}

export const reputationConsumer: ConsumerRegistration = {
  name: 'reputation',
  subjects: [
    'gtarp.crime.committed',
    'gtarp.arrest.made',
    'gtarp.bribe.accepted',
    'gtarp.territory.lost',
    'gtarp.business.robbed',
  ],
  handler: async (job: Job<DomainEvent>) => {
    await applyReputationDeltas(getPrisma(), job.data);
  },
};

export function registerReputationEngine(): void {
  registerConsumer(reputationConsumer);
}
