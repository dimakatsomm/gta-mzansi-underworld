import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@gtarp/db';
import type { EventBus } from '@gtarp/event-bus';
import type { Redis } from 'ioredis';
import { healthzRoute } from './routes/healthz.js';
import { eventsRoute } from './routes/events.js';

export interface BuildServerOptions {
  prisma?: PrismaClient;
  eventBus?: EventBus;
  redis?: Redis;
}

export async function buildServer(opts: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(healthzRoute);

  if (opts.prisma && opts.eventBus && opts.redis) {
    await app.register(rateLimit, { global: false, redis: opts.redis });
    await app.register(eventsRoute, { prisma: opts.prisma, eventBus: opts.eventBus });
  }

  return app;
}
