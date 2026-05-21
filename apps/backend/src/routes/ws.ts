import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { EventBus } from '@gtarp/event-bus';
import type { DispatchRequested } from '@gtarp/event-schema';

interface WsPluginOptions extends FastifyPluginOptions {
  eventBus: EventBus;
}

const connectedClients = new Set<WebSocket>();

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

  app.get('/ws/fivem', { websocket: true }, (socket, req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token || token !== process.env['FIVEM_INGEST_TOKEN']) {
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
  await eventBus.subscribe(
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
    { durableName: 'fivem-ws-bridge', deliverPolicy: 'new' },
  );
}
