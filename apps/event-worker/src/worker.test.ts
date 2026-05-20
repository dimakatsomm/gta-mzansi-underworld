import { afterEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthzPlugin } from './healthz.js';

describe('event-worker /healthz', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('returns 200 with status ok and a time string', async () => {
    app = Fastify({ logger: false });
    await app.register(healthzPlugin);

    const res = await app.inject({ method: 'GET', url: '/healthz' });

    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { status: string; time: string };
    expect(body.status).toBe('ok');
    expect(() => new Date(body.time).toISOString()).not.toThrow();
  });
});
