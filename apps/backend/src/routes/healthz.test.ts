import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';

describe('GET /healthz', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('returns 200 with status ok, sha, and time', async () => {
    app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/healthz' });

    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as {
      status: string;
      sha: string;
      time: string;
    };

    expect(body.status).toBe('ok');
    expect(typeof body.sha).toBe('string');
    expect(typeof body.time).toBe('string');
    // time should be a valid ISO-8601 datetime
    expect(() => new Date(body.time).toISOString()).not.toThrow();
  });
});
