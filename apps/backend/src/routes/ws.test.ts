import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyPluginCallback } from 'fastify';
import websocket from '@fastify/websocket';
import type { EventBus } from '@gtarp/event-bus';
import { wsRoute } from './ws.js';

function makeBus(): EventBus {
  return {
    publish: vi.fn(async () => undefined),
    subscribe: vi.fn(async () => ({ close: vi.fn() }) as never),
    close: vi.fn(async () => undefined),
  } as unknown as EventBus;
}

describe('wsRoute', () => {
  const ORIG_TOKEN = process.env['FIVEM_INGEST_TOKEN'];

  beforeEach(() => {
    process.env['FIVEM_INGEST_TOKEN'] = 'test-secret';
  });

  afterEach(() => {
    if (ORIG_TOKEN === undefined) delete process.env['FIVEM_INGEST_TOKEN'];
    else process.env['FIVEM_INGEST_TOKEN'] = ORIG_TOKEN;
  });

  it('is exported as a function', () => {
    expect(typeof wsRoute).toBe('function');
  });

  it('registers without error when FIVEM_INGEST_TOKEN is set', async () => {
    const app = Fastify();
    await app.register(websocket as FastifyPluginCallback);
    await expect(app.register(wsRoute, { eventBus: makeBus() })).resolves.not.toThrow();
    await app.close();
  });

  it('throws at registration if FIVEM_INGEST_TOKEN is missing', async () => {
    delete process.env['FIVEM_INGEST_TOKEN'];
    const app = Fastify();
    await app.register(websocket as FastifyPluginCallback);
    await expect(app.register(wsRoute, { eventBus: makeBus() })).rejects.toThrow(
      /FIVEM_INGEST_TOKEN/,
    );
    await app.close();
  });

  it('subscribes to gtarp.dispatch.requested on the event bus', async () => {
    const bus = makeBus();
    const app = Fastify();
    await app.register(websocket as FastifyPluginCallback);
    await app.register(wsRoute, { eventBus: bus });
    expect(bus.subscribe).toHaveBeenCalledWith(
      'gtarp.dispatch.requested',
      expect.any(Function),
      expect.objectContaining({ deliverPolicy: 'new' }),
    );
    await app.close();
  });

  it('uses a per-instance durable name including the process pid', async () => {
    const bus = makeBus();
    const app = Fastify();
    await app.register(websocket as FastifyPluginCallback);
    await app.register(wsRoute, { eventBus: bus });
    const opts = (bus.subscribe as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[2] as { durableName?: string } | undefined;
    expect(opts?.durableName).toMatch(new RegExp(`-${process.pid}-`));
    await app.close();
  });
});
