import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { PrismaClient } from '@gtarp/db';

interface ReputationPluginOptions extends FastifyPluginOptions {
  prisma: PrismaClient;
}

const ALLOWED_AXES = new Set(['criminal', 'safety', 'corruption', 'integrity', 'stability']);

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function reputationRoute(
  app: FastifyInstance,
  opts: ReputationPluginOptions,
): Promise<void> {
  const { prisma } = opts;

  app.get('/reputation', async (req, reply) => {
    const token = firstValue(req.headers['x-fivem-ingest-token']);
    if (!token || token !== process.env['FIVEM_INGEST_TOKEN']) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = req.query as { area?: string | string[]; axis?: string | string[] };
    const area = firstValue(query.area);
    const axis = firstValue(query.axis);

    if (!area || !axis || !ALLOWED_AXES.has(axis)) {
      return reply.status(400).send({ error: 'Invalid query' });
    }

    const rep = await prisma.reputation.findFirst({
      where: {
        area,
        axis,
        playerId: null,
        gangId: null,
        familyId: null,
        businessId: null,
      },
    });

    return reply.send({ score: rep?.score ?? 0 });
  });
}
