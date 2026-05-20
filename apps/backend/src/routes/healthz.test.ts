import { describe, it, expect } from 'vitest';
import { buildServer } from '../server.js';

describe('GET /healthz', () => {
  it('returns 200 with status ok, sha, and time', async () => {
    const app = buildServer();
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
