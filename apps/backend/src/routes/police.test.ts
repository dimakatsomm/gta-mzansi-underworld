import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import type { PrismaClient } from '@gtarp/db';

const TEST_TOKEN = 'test-token';

// Minimal Prisma mock — only the methods police.ts actually calls
function makePrismaMock(findManyResult: unknown[] = []): PrismaClient {
  return {
    player: {
      findMany: vi.fn().mockResolvedValue(findManyResult),
    },
    // provide stubs for every other model the server setup might touch
    eventLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaClient;
}

const SAMPLE_PLAYER = {
  id: 'player-uuid-1',
  displayName: 'John Doe',
  fivemLicense: 'license:abc123',
  identities: [
    {
      firstName: 'John',
      lastName: 'Doe',
      idNumber: 'ZA9001015000000',
      province: 'GP',
    },
  ],
  criminalRecord: {
    totalArrests: 3,
    totalConvictions: 1,
    notorietyScore: 42.5,
  },
  crimesAsPerp: [
    {
      role: 'primary',
      crime: {
        id: 'crime-uuid-1',
        type: 'robbery',
        severity: 'major',
        committedAt: new Date('2025-01-15T10:00:00Z'),
        province: 'GP',
        area: 'Johannesburg CBD',
      },
    },
  ],
  warrants: [
    {
      id: 'warrant-uuid-1',
      crimeId: 'crime-uuid-1',
      issuedAt: new Date('2025-01-16T08:00:00Z'),
    },
  ],
};

describe('GET /police/mdt/search', () => {
  let app: FastifyInstance | undefined;

  beforeEach(() => {
    vi.stubEnv('FIVEM_INGEST_TOKEN', TEST_TOKEN);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 401 when x-fivem-ingest-token header is missing', async () => {
    app = await buildServer({ prisma: makePrismaMock() });
    const res = await app.inject({ method: 'GET', url: '/police/mdt/search?q=john' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when x-fivem-ingest-token header is wrong', async () => {
    app = await buildServer({ prisma: makePrismaMock() });
    const res = await app.inject({
      method: 'GET',
      url: '/police/mdt/search?q=john',
      headers: { 'x-fivem-ingest-token': 'wrong-token' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when q param is missing', async () => {
    app = await buildServer({ prisma: makePrismaMock() });
    const res = await app.inject({
      method: 'GET',
      url: '/police/mdt/search',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toMatch(/missing/i);
  });

  it('returns 400 when q is too short (1 char)', async () => {
    app = await buildServer({ prisma: makePrismaMock() });
    const res = await app.inject({
      method: 'GET',
      url: '/police/mdt/search?q=x',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toMatch(/2 and 60/);
  });

  it('returns 400 when q is too long (61 chars)', async () => {
    app = await buildServer({ prisma: makePrismaMock() });
    const q = 'a'.repeat(61);
    const res = await app.inject({
      method: 'GET',
      url: `/police/mdt/search?q=${q}`,
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toMatch(/2 and 60/);
  });

  it('returns 200 with correct shape for valid query matching one player', async () => {
    const prisma = makePrismaMock([SAMPLE_PLAYER]);
    app = await buildServer({ prisma });
    const res = await app.inject({
      method: 'GET',
      url: '/police/mdt/search?q=john',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });

    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      results: Array<{
        playerId: string;
        displayName: string;
        fivemLicense: string;
        identities: Array<{
          firstName: string;
          lastName: string;
          idNumber: string;
          province: string;
        }>;
        criminalRecord: {
          totalArrests: number;
          totalConvictions: number;
          notorietyScore: number;
        } | null;
        recentCrimes: Array<{
          crimeId: string;
          type: string;
          severity: string;
          committedAt: string;
          province: string;
          area: string;
          role: string;
        }>;
        openWarrants: Array<{ warrantId: string; crimeId: string; issuedAt: string }>;
      }>;
    };

    expect(body.results).toHaveLength(1);

    const p = body.results[0]!;
    expect(p.playerId).toBe('player-uuid-1');
    expect(p.displayName).toBe('John Doe');
    expect(p.fivemLicense).toBe('license:abc123');

    // identities
    expect(p.identities).toHaveLength(1);
    expect(p.identities[0]!.firstName).toBe('John');
    expect(p.identities[0]!.idNumber).toBe('ZA9001015000000');

    // criminalRecord
    expect(p.criminalRecord).not.toBeNull();
    expect(p.criminalRecord!.totalArrests).toBe(3);
    expect(p.criminalRecord!.totalConvictions).toBe(1);
    expect(p.criminalRecord!.notorietyScore).toBe(42.5);

    // recentCrimes
    expect(p.recentCrimes).toHaveLength(1);
    expect(p.recentCrimes[0]!.crimeId).toBe('crime-uuid-1');
    expect(p.recentCrimes[0]!.type).toBe('robbery');
    expect(p.recentCrimes[0]!.role).toBe('primary');

    // openWarrants
    expect(p.openWarrants).toHaveLength(1);
    expect(p.openWarrants[0]!.warrantId).toBe('warrant-uuid-1');
    expect(p.openWarrants[0]!.crimeId).toBe('crime-uuid-1');

    // Verify prisma was called with correct args

    expect(prisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { displayName: { contains: 'john', mode: 'insensitive' } },
        take: 10,
      }),
    );
  });

  it('returns 200 with empty results when no players match', async () => {
    app = await buildServer({ prisma: makePrismaMock([]) });
    const res = await app.inject({
      method: 'GET',
      url: '/police/mdt/search?q=nomatch',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { results: unknown[] };
    expect(body.results).toHaveLength(0);
  });

  it('returns 200 with null criminalRecord when player has none', async () => {
    const playerWithoutRecord = { ...SAMPLE_PLAYER, criminalRecord: null };
    app = await buildServer({ prisma: makePrismaMock([playerWithoutRecord]) });
    const res = await app.inject({
      method: 'GET',
      url: '/police/mdt/search?q=john',
      headers: { 'x-fivem-ingest-token': TEST_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { results: Array<{ criminalRecord: null }> };
    expect(body.results[0]!.criminalRecord).toBeNull();
  });
});
