import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { PrismaClient } from '@gtarp/db';

interface PolicePluginOptions extends FastifyPluginOptions {
  prisma: PrismaClient;
}

function safeTokenEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.byteLength === bb.byteLength && timingSafeEqual(ab, bb);
}

export async function policeRoute(app: FastifyInstance, opts: PolicePluginOptions): Promise<void> {
  const { prisma } = opts;

  app.get('/police/mdt/search', async (req, reply) => {
    // Auth — normalize header value (Fastify may give string | string[])
    const rawToken = req.headers['x-fivem-ingest-token'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const expected = process.env['FIVEM_INGEST_TOKEN'];
    if (!token || !expected || !safeTokenEqual(token, expected)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Query param validation — guard against string[] (e.g. ?q=a&q=b)
    const { q: rawQ } = req.query as Record<string, unknown>;
    if (!rawQ || typeof rawQ !== 'string') {
      return reply.status(400).send({ error: 'Missing query parameter: q' });
    }
    const q = rawQ.trim();
    if (q.length < 2 || q.length > 60) {
      return reply
        .status(400)
        .send({ error: 'Query parameter q must be between 2 and 60 characters' });
    }

    // Search players
    const players = await prisma.player.findMany({
      where: {
        displayName: {
          contains: q,
          mode: 'insensitive',
        },
      },
      take: 10,
      include: {
        identities: {
          select: {
            firstName: true,
            lastName: true,
            idNumber: true,
            province: true,
          },
        },
        criminalRecord: {
          select: {
            totalArrests: true,
            totalConvictions: true,
            notorietyScore: true,
          },
        },
        crimesAsPerp: {
          orderBy: {
            crime: { committedAt: 'desc' },
          },
          take: 5,
          select: {
            role: true,
            crime: {
              select: {
                id: true,
                type: true,
                severity: true,
                committedAt: true,
                province: true,
                area: true,
              },
            },
          },
        },
        warrants: {
          where: { status: 'open' },
          select: {
            id: true,
            crimeId: true,
            issuedAt: true,
          },
        },
      },
    });

    const results = players.map((player) => ({
      playerId: player.id,
      displayName: player.displayName,
      fivemLicense: player.fivemLicense,
      identities: player.identities,
      criminalRecord: player.criminalRecord ?? null,
      recentCrimes: player.crimesAsPerp.map((cp) => ({
        crimeId: cp.crime.id,
        type: cp.crime.type,
        severity: cp.crime.severity,
        committedAt: cp.crime.committedAt,
        province: cp.crime.province,
        area: cp.crime.area,
        role: cp.role,
      })),
      openWarrants: player.warrants.map((w) => ({
        warrantId: w.id,
        crimeId: w.crimeId,
        issuedAt: w.issuedAt,
      })),
    }));

    app.log.info(
      {
        actor: req.headers['x-officer-id'] ?? req.ip,
        query: q,
        resultCount: results.length,
      },
      'mdt:search',
    );

    return reply.status(200).send({ results });
  });
}
