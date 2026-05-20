import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@gtarp/db';
import { connect as connectEventBus, type EventBus } from '@gtarp/event-bus';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import type { DomainEvent } from '@gtarp/event-schema';
import type { PrismaClient } from '@gtarp/db';

const TEST_TOKEN = 'test-token';

function makeCrimeEvent(overrides?: Partial<{ id: string; crimeId: string }>): DomainEvent {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    type: 'crime.committed',
    version: 1,
    occurredAt: new Date().toISOString(),
    actor: 'player-001',
    data: {
      crimeId: overrides?.crimeId ?? crypto.randomUUID(),
      crimeType: 'robbery',
      severity: 'major',
      perpetrators: ['player-001'],
      victims: [],
      location: { x: 100, y: 200, z: 10, province: 'GP', area: 'Soweto' },
      witnessed: false,
      witnessIds: [],
    },
  } as DomainEvent;
}

describe('POST /events', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let eventBus: EventBus;
  let redis: Redis;

  beforeAll(async () => {
    process.env['FIVEM_INGEST_TOKEN'] = TEST_TOKEN;
    prisma = getPrisma();
    eventBus = await connectEventBus({
      servers: process.env['NATS_URL'] ?? 'nats://localhost:4222',
    });
    redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
    app = await buildServer({ prisma, eventBus, redis });
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await eventBus.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('returns 401 when x-fivem-ingest-token is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/events', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when x-fivem-ingest-token is wrong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: { 'x-fivem-ingest-token': 'wrong-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when body does not match DomainEvent schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
      payload: { type: 'not.a.real.event', version: 1 },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('Invalid event');
  });

  it('accepts crime.committed, writes EventLog row, publishes JetStream message', async () => {
    const eventId = crypto.randomUUID();
    const received: DomainEvent[] = [];

    const uniqueDurable = `test-ingest-${Date.now()}`;
    const sub = await eventBus.subscribe(
      'gtarp.crime.committed',
      async (evt) => {
        received.push(evt);
      },
      { durableName: uniqueDurable, deliverPolicy: 'new' },
    );

    const event = makeCrimeEvent({ id: eventId });

    const res = await app.inject({
      method: 'POST',
      url: '/events',
      headers: {
        'x-fivem-ingest-token': TEST_TOKEN,
        'x-source-id': 'fivem-server-1',
      },
      payload: event,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { id: string; seq: number };
    expect(body.id).toBe(eventId);
    expect(typeof body.seq).toBe('number');
    expect(body.seq).toBeGreaterThan(0);

    // Verify EventLog row in DB
    const log = await prisma.eventLog.findUniqueOrThrow({ where: { id: eventId } });
    expect(log.id).toBe(eventId);
    expect(log.type).toBe('crime.committed');
    expect(log.published).toBe(true);

    // Wait for JetStream message to be consumed
    await new Promise((r) => setTimeout(r, 1500));
    sub.close();

    // Verify JetStream message received with matching id (EventLog id = Nats-Msg-Id)
    const msg = received.find((m) => m.id === eventId);
    expect(msg).toBeDefined();
    expect(msg?.type).toBe('crime.committed');
  }, 15_000);

  it('returns 429 when rate limit is exceeded', async () => {
    // Use a unique source-id to isolate this test's rate-limit counter
    const sourceId = `rl-test-${crypto.randomUUID()}`;

    // Fire 50 requests (valid token, missing body → hits auth but not DB/NATS)
    // Rate limit fires in onRequest before the handler, so counter is incremented
    // regardless of whether the handler returns 401 or 400.
    const batch = Array.from({ length: 50 }, () =>
      app.inject({
        method: 'POST',
        url: '/events',
        headers: { 'x-fivem-ingest-token': TEST_TOKEN, 'x-source-id': sourceId },
        payload: { bad: 'payload' },
      }),
    );
    const results = await Promise.all(batch);
    // All 50 should pass the rate-limit gate (even if they fail validation as 400)
    const tooManyIdx = results.findIndex((r) => r.statusCode === 429);
    expect(tooManyIdx).toBe(-1); // none of first 50 should be rate-limited

    // 51st should be rate-limited
    const extra = await app.inject({
      method: 'POST',
      url: '/events',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN, 'x-source-id': sourceId },
      payload: { bad: 'payload' },
    });
    expect(extra.statusCode).toBe(429);
  }, 30_000);
});
