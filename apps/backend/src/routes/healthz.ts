import type { FastifyInstance } from 'fastify';

export async function healthzRoute(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      // GIT_SHA is injected at build/deploy time (e.g. via CI env var).
      sha: process.env['GIT_SHA'] ?? 'dev',
      time: new Date().toISOString(),
    });
  });
}
