import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { connect as connectBus } from '@gtarp/event-bus';
import type { DomainEvent } from '@gtarp/event-schema';
import { CONSUMER_NAMES, getConsumersForSubject } from './registry.js';
import {
  eventsReceivedTotal,
  eventsDedupedTotal,
  jobsEnqueuedTotal,
  queueDepthGauge,
} from '../metrics.js';

export interface Bridge {
  close(): Promise<void>;
}

// Retention for completed/failed BullMQ jobs. Without these, Redis grows
// unbounded once events start flowing.
const DEFAULT_JOB_OPTS = {
  removeOnComplete: { count: 1000, age: 60 * 60 * 24 }, // last 1k or 24h
  removeOnFail: { count: 5000, age: 60 * 60 * 24 * 7 }, // last 5k or 7d
} as const;

// How often we sample queue depth for the gauge. Polling per message produced
// a Redis round-trip per event on the hot path — moving to a timer keeps the
// metric fresh enough for dashboards without slowing ingest/acking.
const QUEUE_DEPTH_POLL_MS = 5_000;

export async function startBridge(opts: { natsUrl?: string; redisUrl?: string }): Promise<Bridge> {
  const redisUrl = opts.redisUrl ?? process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  // Dedicated ioredis connection for dedup key operations (plain commands).
  const dedupRedis = new Redis(redisUrl);

  // BullMQ requires its own connection with maxRetriesPerRequest: null.
  const bullRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });

  // Create one Queue per consumer name.
  const queues = new Map<string, Queue>(
    CONSUMER_NAMES.map((name) => [
      name,
      new Queue(name, { connection: bullRedis, defaultJobOptions: DEFAULT_JOB_OPTS }),
    ]),
  );

  // Create one Worker per consumer name. The processor delegates to the
  // registered handler at job-execution time so engines can register after
  // bridge startup.
  const workers: Worker[] = [];
  for (const name of CONSUMER_NAMES) {
    const worker = new Worker<DomainEvent>(
      name,
      async (job: Job<DomainEvent>) => {
        const subject = `gtarp.${job.data.type}`;
        const consumers = getConsumersForSubject(subject);
        const reg = consumers.find((c) => c.name === name);
        if (reg) {
          await reg.handler(job);
        }
        // No handler registered yet — no-op (engine not yet implemented).
      },
      { connection: bullRedis },
    );
    workers.push(worker);
  }

  // Connect to NATS via event-bus wrapper.
  const bus = await connectBus({
    servers: opts.natsUrl ?? process.env['NATS_URL'] ?? 'nats://localhost:4222',
  });

  // Single subscription for all gtarp.> events. The event-bus subscribe
  // contract: it does NOT auto-ack — handlers must call `msg.ack()` themselves
  // (and a thrown error leaves the message un-acked for redelivery).
  const sub = await bus.subscribe(
    'gtarp.>',
    async (evt: DomainEvent, msg) => {
      const subject = msg.subject;
      eventsReceivedTotal.inc({ subject });

      // Redis dedup: SET NX with 24-hour TTL.
      // If enqueue fails below, we DELETE the key so a JetStream redelivery
      // gets a fresh dedup slot — otherwise the event would be silently dropped.
      const dedupKey = `event:${evt.id}`;
      const isNew = await dedupRedis.set(dedupKey, '1', 'EX', 86400, 'NX');
      if (!isNew) {
        eventsDedupedTotal.inc();
        msg.ack();
        return;
      }

      try {
        const matchingConsumers = getConsumersForSubject(subject);
        for (const consumer of matchingConsumers) {
          const queue = queues.get(consumer.name);
          if (queue) {
            // jobId provides BullMQ-level dedup as a secondary safeguard.
            await queue.add(evt.type, evt, {
              // BullMQ disallows `:` in custom job IDs (reserved as Redis key
              // separator) — use `-` between consumer name and event id.
              jobId: `${consumer.name}-${evt.id}`,
            });
            jobsEnqueuedTotal.inc({ queue: consumer.name });
          }
        }
      } catch (err) {
        console.error('[bridge] enqueue failed — releasing dedup key for redelivery', err);
        await dedupRedis.del(dedupKey).catch(() => {
          /* best-effort */
        });
        // Do not ack — let JetStream redeliver.
        throw err;
      }

      msg.ack();
    },
    { durableName: 'bridge-main', deliverPolicy: 'new' },
  );

  // Periodically refresh queue-depth gauge instead of polling per message.
  const queueDepthTimer = setInterval(() => {
    void refreshQueueDepth(queues);
  }, QUEUE_DEPTH_POLL_MS);
  // Don't keep the process alive on this timer alone.
  if (typeof queueDepthTimer.unref === 'function') queueDepthTimer.unref();

  return {
    async close() {
      clearInterval(queueDepthTimer);
      sub.close();
      await Promise.all(workers.map((w) => w.close()));
      await Promise.all([...queues.values()].map((q) => q.close()));
      await bus.close();
      dedupRedis.disconnect();
      bullRedis.disconnect();
    },
  };
}

async function refreshQueueDepth(queues: Map<string, Queue>): Promise<void> {
  for (const [name, queue] of queues) {
    try {
      const counts = await queue.getJobCounts('waiting', 'active');
      queueDepthGauge.set({ queue: name }, (counts['waiting'] ?? 0) + (counts['active'] ?? 0));
    } catch {
      // gauge stays at its previous value
    }
  }
}
