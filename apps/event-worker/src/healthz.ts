import type { FastifyInstance } from 'fastify';

/**
 * Thin /healthz plugin — extracted so tests can register it without
 * booting the full NATS/Redis connections.
 */
export async function healthzPlugin(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_req, reply) => {
    return reply.send({ status: 'ok', time: new Date().toISOString() });
  });
}
