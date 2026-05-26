import Fastify from 'fastify';
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { RateLimitPluginOptions } from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import type { PrismaClient } from '@gtarp/db';
import type { EventBus } from '@gtarp/event-bus';
import type { Redis } from 'ioredis';
import { healthzRoute } from './routes/healthz.js';
import { eventsRoute } from './routes/events.js';
import { wsRoute } from './routes/ws.js';
import { policeRoute } from './routes/police.js';
import { reputationRoute } from './routes/reputation.js';

export interface BuildServerOptions {
  prisma?: PrismaClient;
  eventBus?: EventBus;
  redis?: Redis;
}

export async function buildServer(opts: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(healthzRoute);

  // Rate limiter needs Redis. Events ingest needs Prisma + EventBus. WebSocket
  // dispatch fan-out only needs EventBus and should not be gated on Prisma/Redis
  // — gating it together meant /ws/fivem was silently disabled in eventBus-only
  // deployments (e.g. read-only replicas, integration test harnesses).
  if (opts.redis) {
    // Cast: Fastify v5 FastifyRegister doesn't thread the instance TypeProvider
    // into its overloads (TypeProviderDefault stays FastifyTypeProvider). Cast to
    // FastifyPluginCallback<Options> so TypeProvider infers as FastifyTypeProviderDefault.
    await app.register(rateLimit as FastifyPluginCallback<RateLimitPluginOptions>, {
      global: false,
      redis: opts.redis,
    });
  }
  if (opts.prisma && opts.eventBus) {
    await app.register(eventsRoute, { prisma: opts.prisma, eventBus: opts.eventBus });
  }
  if (opts.prisma) {
    await app.register(reputationRoute, { prisma: opts.prisma });
    await app.register(policeRoute, { prisma: opts.prisma });
  }
  if (opts.eventBus) {
    await app.register(websocket as FastifyPluginCallback);
    await app.register(wsRoute, { eventBus: opts.eventBus });
  }

  return app;
}
