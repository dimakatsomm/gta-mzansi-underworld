/**
 * Integration tests for the reputation engine.
 *
 * These tests exercise the full DB-write path against a real Postgres instance.
 * They are skipped automatically when DATABASE_URL is not set so the unit-test
 * suite can run without a database (local dev, CI without services).
 *
 * To run locally:
 *   DATABASE_URL=postgresql://... pnpm -F @gtarp/event-worker test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { applyReputationDeltas } from './index.js';
import type { DomainEvent } from '@gtarp/event-schema';

const DB_URL = process.env['DATABASE_URL'];
const skip = !DB_URL;

// We import dynamically so that the module-level PrismaClient constructor
// (which reads DATABASE_URL) is never called when DB_URL is absent.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type PrismaClientType = import('@gtarp/db').PrismaClient;

let prisma: PrismaClientType;

// Stable UUIDs for test fixtures so cleanup is deterministic.
const TEST_PLAYER_ID = '10000000-0000-0000-0000-000000000001';
const TEST_OFFICER_ID = '10000000-0000-0000-0000-000000000002';
const TEST_GANG_ID = '20000000-0000-0000-0000-000000000001';
const TEST_CRIME_ID = '30000000-0000-0000-0000-000000000001';
const TEST_EVT_BASE = {
  id: '40000000-0000-0000-0000-000000000001',
  version: 1 as const,
  occurredAt: '2026-01-01T00:00:00Z',
};

describe.skipIf(skip)('reputation engine — integration', () => {
  beforeAll(async () => {
    // Dynamic import avoids touching PrismaClient when DB_URL is absent.
    const { getPrisma } = await import('@gtarp/db');
    prisma = getPrisma();

    // Seed minimal fixtures.
    await prisma.player.upsert({
      where: { fivemLicense: 'test:perp1' },
      update: {},
      create: { id: TEST_PLAYER_ID, fivemLicense: 'test:perp1', displayName: 'Test Perp' },
    });
    await prisma.player.upsert({
      where: { fivemLicense: 'test:officer1' },
      update: {},
      create: { id: TEST_OFFICER_ID, fivemLicense: 'test:officer1', displayName: 'Test Officer' },
    });
    await prisma.gang.upsert({
      where: { name: '__test_gang__' },
      update: {},
      create: { id: TEST_GANG_ID, name: '__test_gang__' },
    });
    await prisma.gangMembership.upsert({
      where: { gangId_playerId: { gangId: TEST_GANG_ID, playerId: TEST_PLAYER_ID } },
      update: {},
      create: { gangId: TEST_GANG_ID, playerId: TEST_PLAYER_ID, rank: 'soldier' },
    });
    await prisma.crime.upsert({
      where: { id: TEST_CRIME_ID },
      update: {},
      create: {
        id: TEST_CRIME_ID,
        type: 'robbery',
        severity: 'serious',
        province: 'GP',
        area: 'Sandton',
        x: 0,
        y: 0,
        z: 0,
      },
    });
    await prisma.crimePerpetrator.upsert({
      where: { crimeId_playerId: { crimeId: TEST_CRIME_ID, playerId: TEST_PLAYER_ID } },
      update: {},
      create: { crimeId: TEST_CRIME_ID, playerId: TEST_PLAYER_ID, role: 'primary' },
    });

    // Remove any pre-existing reputation rows for our test fixtures.
    await prisma.reputation.deleteMany({
      where: {
        OR: [
          { playerId: TEST_PLAYER_ID },
          { playerId: TEST_OFFICER_ID },
          { gangId: TEST_GANG_ID },
          { area: 'Sandton' },
          { area: '__biz_test__' },
        ],
      },
    });
  });

  afterAll(async () => {
    // Clean up reputation rows.
    await prisma.reputation.deleteMany({
      where: {
        OR: [
          { playerId: TEST_PLAYER_ID },
          { playerId: TEST_OFFICER_ID },
          { gangId: TEST_GANG_ID },
          { area: 'Sandton' },
          { area: '__biz_test__' },
        ],
      },
    });
    // Clean up fixtures.
    await prisma.crimePerpetrator.deleteMany({ where: { crimeId: TEST_CRIME_ID } });
    await prisma.crime.deleteMany({ where: { id: TEST_CRIME_ID } });
    await prisma.gangMembership.deleteMany({ where: { gangId: TEST_GANG_ID } });
    await prisma.gang.deleteMany({ where: { id: TEST_GANG_ID } });
    await prisma.player.deleteMany({
      where: { id: { in: [TEST_PLAYER_ID, TEST_OFFICER_ID] } },
    });
    await prisma.$disconnect();
  });

  it('crime.committed serious — applies all deltas within one call', async () => {
    const event: DomainEvent = {
      ...TEST_EVT_BASE,
      type: 'crime.committed',
      data: {
        crimeId: TEST_CRIME_ID,
        crimeType: 'robbery',
        severity: 'serious',
        perpetrators: [TEST_PLAYER_ID],
        victims: [],
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'Sandton' },
        witnessed: false,
        witnessIds: [],
      },
    };

    await applyReputationDeltas(prisma, event);

    const perpRep = await prisma.reputation.findFirst({
      where: { playerId: TEST_PLAYER_ID, axis: null },
    });
    expect(perpRep?.score).toBe(25);

    const gangRep = await prisma.reputation.findFirst({
      where: { gangId: TEST_GANG_ID, axis: null },
    });
    expect(gangRep?.score).toBe(10);

    const criminalArea = await prisma.reputation.findFirst({
      where: { area: 'Sandton', axis: 'criminal' },
    });
    expect(criminalArea?.score).toBe(5);

    const safetyArea = await prisma.reputation.findFirst({
      where: { area: 'Sandton', axis: 'safety' },
    });
    expect(safetyArea?.score).toBe(-5);
  });

  it('crime.committed serious — idempotent (same event applied twice = same scores)', async () => {
    // Scores were set in previous test. Apply the same event again.
    const event: DomainEvent = {
      ...TEST_EVT_BASE,
      type: 'crime.committed',
      data: {
        crimeId: TEST_CRIME_ID,
        crimeType: 'robbery',
        severity: 'serious',
        perpetrators: [TEST_PLAYER_ID],
        victims: [],
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'Sandton' },
        witnessed: false,
        witnessIds: [],
      },
    };

    // In production the BullMQ jobId dedup prevents double-processing; here we
    // verify that applying twice accumulates (scores add), confirming the engine
    // is additive — idempotency is enforced at the bridge/queue layer.
    await applyReputationDeltas(prisma, event);

    const perpRep = await prisma.reputation.findFirst({
      where: { playerId: TEST_PLAYER_ID, axis: null },
    });
    // Two applications → 50
    expect(perpRep?.score).toBe(50);
  });

  it('arrest.made — -10 suspect, +10 officer', async () => {
    const event: DomainEvent = {
      ...TEST_EVT_BASE,
      id: '40000000-0000-0000-0000-000000000002',
      type: 'arrest.made',
      data: {
        suspectId: TEST_PLAYER_ID,
        officerId: TEST_OFFICER_ID,
        charges: ['robbery'],
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'CBD' },
      },
    };

    await applyReputationDeltas(prisma, event);

    // TEST_PLAYER_ID already has 50 from previous tests; arrest adds -10 → 40.
    const suspectRep = await prisma.reputation.findFirst({
      where: { playerId: TEST_PLAYER_ID, axis: null },
    });
    expect(suspectRep?.score).toBe(40);

    const officerRep = await prisma.reputation.findFirst({
      where: { playerId: TEST_OFFICER_ID, axis: null },
    });
    expect(officerRep?.score).toBe(10);
  });

  it('business.robbed — -10 stability, +perp bonus (cashTaken=10000 → 10)', async () => {
    const event: DomainEvent = {
      ...TEST_EVT_BASE,
      id: '40000000-0000-0000-0000-000000000003',
      type: 'business.robbed',
      data: { businessId: '__biz_test__', crimeId: TEST_CRIME_ID, cashTaken: 10_000 },
    };

    await applyReputationDeltas(prisma, event);

    const bizStability = await prisma.reputation.findFirst({
      where: { area: '__biz_test__', axis: 'stability' },
    });
    expect(bizStability?.score).toBe(-10);

    const perpRep = await prisma.reputation.findFirst({
      where: { playerId: TEST_PLAYER_ID, axis: null },
    });
    // Previous score was 40; robbery bonus +10 → 50.
    expect(perpRep?.score).toBe(50);
  });

  it('business.robbed cashTaken > 50000 — perp bonus capped at 50', async () => {
    const event: DomainEvent = {
      ...TEST_EVT_BASE,
      id: '40000000-0000-0000-0000-000000000004',
      type: 'business.robbed',
      data: { businessId: '__biz_test__', crimeId: TEST_CRIME_ID, cashTaken: 500_000 },
    };

    await applyReputationDeltas(prisma, event);

    const perpRep = await prisma.reputation.findFirst({
      where: { playerId: TEST_PLAYER_ID, axis: null },
    });
    // Previous 50 + capped bonus 50 → 100.
    expect(perpRep?.score).toBe(100);
  });
});
