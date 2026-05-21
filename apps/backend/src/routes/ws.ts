import { hostname } from 'node:os';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { EventBus, Subscription } from '@gtarp/event-bus';
import type { DispatchRequested } from '@gtarp/event-schema';

interface WsPluginOptions extends FastifyPluginOptions {
  eventBus: EventBus;
}

/**
 * WebSocket bridge for FiveM server connections.
 *
 * FiveM server-side Lua connects here to receive real-time `dispatch.requested`
 * events. Auth via `Authorization: Bearer <FIVEM_INGEST_TOKEN>` header.
 *
 * GET /ws/fivem — WebSocket upgrade endpoint.
 */
export async function wsRoute(app: FastifyInstance, opts: WsPluginOptions): Promise<void> {
  const { eventBus } = opts;

  // Fail fast at registration if the auth secret is missing — otherwise every
  // FiveM connection would be silently rejected with no startup signal.
  const expectedToken = process.env['FIVEM_INGEST_TOKEN'];
  if (!expectedToken) {
    throw new Error(
      'FIVEM_INGEST_TOKEN is not set — /ws/fivem cannot authenticate any clients. Set the env var or do not register wsRoute.',
    );
  }

  // Plugin-scoped — one Set per registered route, so multiple Fastify instances
  // (e.g. test runs in the same process) do not share state.
  const connectedClients = new Set<WebSocket>();

  app.get('/ws/fivem', { websocket: true }, (socket, req) => {
    const rawAuth = req.headers['authorization'];
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token || token !== expectedToken) {
      socket.send(JSON.stringify({ error: 'Unauthorized' }));
      socket.close(1008, 'Unauthorized');
      return;
    }

    connectedClients.add(socket);
    app.log.info(`[ws] FiveM client connected — total=${connectedClients.size}`);

    socket.on('close', () => {
      connectedClients.delete(socket);
      app.log.info(`[ws] FiveM client disconnected — total=${connectedClients.size}`);
    });

    socket.on('error', (err: Error) => {
      app.log.error({ err }, '[ws] FiveM socket error');
      connectedClients.delete(socket);
    });
  });

  // Subscribe to NATS dispatch.requested and fan-out to all connected WS clients.
  const subscription: Subscription = await eventBus.subscribe(
    'gtarp.dispatch.requested',
    async (evt) => {
      if (evt.type !== 'dispatch.requested') return;
      const payload = JSON.stringify(evt as DispatchRequested);
      for (const client of connectedClients) {
        try {
          client.send(payload);
        } catch (err) {
          app.log.warn({ err }, '[ws] failed to send to FiveM client — removing');
          connectedClients.delete(client);
        }
      }
    },
    {
      // Each backend instance needs its OWN copy of every dispatch event so it
      // can fan out to its own connected FiveM clients. A shared durable name
      // would load-balance messages between replicas instead. Include
      // hostname+pid+random suffix so horizontally-scaled deployments each get
      // a distinct consumer.
      durableName: `fivem-ws-bridge-${sanitiseDurable(hostname())}-${process.pid}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      deliverPolicy: 'new',
    },
  );

  // Close the JetStream subscription and all WS clients on Fastify shutdown so
  // the consumer is not left dangling (hot-reload, tests, graceful restart).
  app.addHook('onClose', async () => {
    try {
      await subscription.close();
    } catch (err) {
      app.log.warn({ err }, '[ws] failed to close NATS subscription');
    }
    for (const client of connectedClients) {
      try {
        client.close(1001, 'server shutdown');
      } catch {
        /* socket may already be closed */
      }
    }
    connectedClients.clear();
  });
}

/** JetStream durable names allow only [A-Za-z0-9_-]. */
function sanitiseDurable(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
}
