/**
 * Cross-cutting M1 E2E test.
 *
 * Verifies the full pipeline in a single process:
 *   POST /events (backend) → EventLog row → NATS JetStream
 *   → BullMQ bridge dedup → reputation queue → Reputation row updated
 *
 * Skipped automatically when DATABASE_URL or NATS_URL is absent so the suite
 * runs in environments without infra (e.g. pure unit-test runs).
 *
 * Requires: Postgres, Redis, NATS (with JetStream) all reachable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@gtarp/db';
import { connect as connectBus } from '@gtarp/event-bus';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import type { DomainEvent } from '@gtarp/event-schema';
import { startBridge } from './bridge/index.js';
import { registerReputationEngine } from './engines/reputation/index.js';

// Dynamic import avoids touching buildServer (and PrismaClient in its module
// graph) when infra is absent.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type BuildServerFn = typeof import('@gtarp/backend/server').buildServer;

const DB_URL = process.env['DATABASE_URL'];
const NATS_URL = process.env['NATS_URL'] ?? 'nats://localhost:4222';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const skip = !DB_URL;

describe.skipIf(skip)('M1 cross-cutting E2E', () => {
  let app: FastifyInstance;
  let bridge: Awaited<ReturnType<typeof startBridge>>;
  let redis: Redis;

  // Stable test fixtures.
  const E2E_PLAYER_ID = 'e0000000-0000-0000-0000-000000000001';
  const E2E_GANG_ID = 'e0000000-0000-0000-0000-000000000002';
  const E2E_CRIME_ID = 'e0000000-0000-0000-0000-000000000003';
  const E2E_EVENT_ID = 'e0000000-0000-0000-0000-000000000004';
  const INGEST_TOKEN = 'e2e-test-token';

  beforeAll(async () => {
    process.env['FIVEM_INGEST_TOKEN'] = INGEST_TOKEN;

    // ── DB fixtures ──────────────────────────────────────────────────────────
    const prisma = getPrisma();
    await prisma.player.upsert({
      where: { fivemLicense: 'seed_e2e_player' },
      update: {},
      create: { id: E2E_PLAYER_ID, fivemLicense: 'seed_e2e_player', displayName: 'E2E Player' },
    });
    await prisma.gang.upsert({
      where: { name: '__e2e_gang__' },
      update: {},
      create: { id: E2E_GANG_ID, name: '__e2e_gang__' },
    });
    await prisma.gangMembership.upsert({
      where: { gangId_playerId: { gangId: E2E_GANG_ID, playerId: E2E_PLAYER_ID } },
      update: {},
      create: { gangId: E2E_GANG_ID, playerId: E2E_PLAYER_ID, rank: 'soldier' },
    });
    await prisma.crime.upsert({
      where: { id: E2E_CRIME_ID },
      update: {},
      create: {
        id: E2E_CRIME_ID,
        type: 'robbery',
        severity: 'serious',
        province: 'GP',
        area: 'e2e_area',
        x: 0,
        y: 0,
        z: 0,
      },
    });
    await prisma.crimePerpetrator.upsert({
      where: { crimeId_playerId: { crimeId: E2E_CRIME_ID, playerId: E2E_PLAYER_ID } },
      update: {},
      create: { crimeId: E2E_CRIME_ID, playerId: E2E_PLAYER_ID, role: 'primary' },
    });
    // Wipe any prior reputation rows for our test entities.
    await prisma.reputation.deleteMany({
      where: {
        OR: [{ playerId: E2E_PLAYER_ID }, { gangId: E2E_GANG_ID }, { area: 'e2e_area' }],
      },
    });
    await prisma.eventLog.deleteMany({ where: { id: E2E_EVENT_ID } });
    await prisma.$disconnect();

    // ── Start engine + bridge ────────────────────────────────────────────────
    registerReputationEngine();
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    bridge = await startBridge({ natsUrl: NATS_URL, redisUrl: REDIS_URL });

    // Clear any stale dedup key from a previous run.
    await redis.del(`event:${E2E_EVENT_ID}`);

    // ── Start backend server ─────────────────────────────────────────────────
    const { buildServer } = (await import('@gtarp/backend/server')) as {
      buildServer: BuildServerFn;
    };
    const eventBus = await connectBus({ servers: NATS_URL });
    const serverRedis = new Redis(REDIS_URL);
    const prismaForServer = getPrisma();
    app = await buildServer({ prisma: prismaForServer, eventBus, redis: serverRedis });
    await app.ready();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await bridge?.close();
    redis?.disconnect();

    // Cleanup DB fixtures.
    const prisma = getPrisma();
    await prisma.reputation.deleteMany({
      where: {
        OR: [{ playerId: E2E_PLAYER_ID }, { gangId: E2E_GANG_ID }, { area: 'e2e_area' }],
      },
    });
    await prisma.eventLog.deleteMany({ where: { id: E2E_EVENT_ID } });
    await prisma.crimePerpetrator.deleteMany({ where: { crimeId: E2E_CRIME_ID } });
    await prisma.crime.deleteMany({ where: { id: E2E_CRIME_ID } });
    await prisma.gangMembership.deleteMany({ where: { gangId: E2E_GANG_ID } });
    await prisma.gang.deleteMany({ where: { id: E2E_GANG_ID } });
    await prisma.player.deleteMany({ where: { id: E2E_PLAYER_ID } });
    await prisma.$disconnect();
  });

  it('POST crime.committed → EventLog row → NATS → reputation queue → Reputation rows within 2s', async () => {
    const event: DomainEvent = {
      id: E2E_EVENT_ID,
      type: 'crime.committed',
      version: 1,
      occurredAt: new Date().toISOString(),
      actor: E2E_PLAYER_ID,
      data: {
        crimeId: E2E_CRIME_ID,
        crimeType: 'robbery',
        severity: 'serious',
        perpetrators: [E2E_PLAYER_ID],
        victims: [],
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'e2e_area' },
        witnessed: false,
        witnessIds: [],
      },
    };

    // 1. POST to backend.
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: {
        'x-fivem-ingest-token': INGEST_TOKEN,
        'x-source-id': 'e2e-fivem-1',
      },
      payload: event,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { id: string; seq: number };
    expect(body.id).toBe(E2E_EVENT_ID);

    // 2. EventLog row written and published flag set.
    const prisma = getPrisma();
    const logRow = await prisma.eventLog.findUniqueOrThrow({ where: { id: E2E_EVENT_ID } });
    expect(logRow.type).toBe('crime.committed');
    expect(logRow.published).toBe(true);

    // 3. Poll for Reputation rows updated by the reputation engine (≤ 2s).
    const deadline = Date.now() + 2_000;
    let perpRep = null;
    let gangRep = null;
    while (Date.now() < deadline) {
      perpRep = await prisma.reputation.findFirst({
        where: { playerId: E2E_PLAYER_ID, axis: null },
      });
      gangRep = await prisma.reputation.findFirst({
        where: { gangId: E2E_GANG_ID, axis: null },
      });
      if (perpRep && gangRep) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await prisma.$disconnect();

    // perp +25, gang +10 per spec.
    expect(perpRep?.score).toBe(25);
    expect(gangRep?.score).toBe(10);
  }, 30_000);
});
