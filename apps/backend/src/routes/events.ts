import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@gtarp/db';
import type { EventBus } from '@gtarp/event-bus';
import { DomainEvent } from '@gtarp/event-schema';

interface EventsPluginOptions extends FastifyPluginOptions {
  prisma: PrismaClient;
  eventBus: EventBus;
}

export async function eventsRoute(app: FastifyInstance, opts: EventsPluginOptions): Promise<void> {
  const { prisma, eventBus } = opts;

  function sourceIdKey(req: FastifyRequest): string {
    const raw = req.headers['x-source-id'];
    const first = Array.isArray(raw) ? raw[0] : raw;
    return first ?? req.ip ?? 'unknown';
  }

  app.post(
    '/events',
    {
      config: {
        rateLimit: {
          max: 50,
          timeWindow: 1000,
          keyGenerator: sourceIdKey,
        },
      },
    },
    async (req, reply) => {
      const token = req.headers['x-fivem-ingest-token'];
      if (!token || token !== process.env['FIVEM_INGEST_TOKEN']) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parsed = DomainEvent.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid event', issues: parsed.error.issues });
      }

      const event = parsed.data;

      // Idempotent ingest: if a row with this id already exists and was published,
      // return success without re-publishing. JetStream's per-msgID dedup would
      // also block duplicates, but short-circuiting here saves a NATS round-trip.
      const existing = await prisma.eventLog.findUnique({ where: { id: event.id } });
      if (existing?.published) {
        return reply.status(200).send({ id: existing.id, duplicate: true });
      }

      const log =
        existing ??
        (await prisma.eventLog.create({
          data: {
            id: event.id,
            type: event.type,
            version: event.version,
            occurredAt: new Date(event.occurredAt),
            actor: event.actor ?? null,
            correlationId: event.correlationId ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: event.data as any,
            published: false,
          },
        }));

      let seq: number;
      try {
        const result = await eventBus.publish(event);
        seq = result.seq;
      } catch (err) {
        app.log.error(err, 'NATS publish failed');
        return reply.status(500).send({ error: 'Event bus failure' });
      }

      try {
        await prisma.eventLog.update({
          where: { id: log.id },
          data: { published: true },
        });
      } catch (err) {
        // JetStream already accepted the event; the row will be reconciled on the
        // next ingest attempt (existing.published === false → retry publish).
        app.log.warn({ err, eventId: log.id }, 'Failed to mark EventLog.published');
      }

      return reply.status(201).send({ id: log.id, seq });
    },
  );
}
