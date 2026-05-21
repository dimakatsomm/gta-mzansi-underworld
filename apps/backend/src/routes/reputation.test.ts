import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma, type PrismaClient } from '@gtarp/db';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';

const TEST_TOKEN = 'test-token';

describe('GET /reputation', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env['FIVEM_INGEST_TOKEN'] = TEST_TOKEN;
    prisma = getPrisma();
    app = await buildServer({ prisma });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns 401 when x-fivem-ingest-token is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/reputation?area=Hillbrow&axis=criminal' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when query is invalid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/reputation?area=Hillbrow&axis=unknown',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns score for area+axis when present', async () => {
    const area = `phara-test-${crypto.randomUUID()}`;
    await prisma.reputation.create({
      data: {
        area,
        axis: 'criminal',
        score: 42,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/reputation?area=${encodeURIComponent(area)}&axis=criminal`,
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { score: number };
    expect(body.score).toBe(42);
  });

  it('returns score 0 when no record exists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/reputation?area=missing-area&axis=criminal',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { score: number };
    expect(body.score).toBe(0);
  });
});
