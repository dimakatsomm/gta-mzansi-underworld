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

export async function startBridge(opts: { natsUrl?: string; redisUrl?: string }): Promise<Bridge> {
  const redisUrl = opts.redisUrl ?? process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  // Dedicated ioredis connection for dedup key operations (plain commands).
  const dedupRedis = new Redis(redisUrl);

  // BullMQ requires its own connection with maxRetriesPerRequest: null.
  const bullRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });

  // Create one Queue per consumer name.
  const queues = new Map<string, Queue>(
    CONSUMER_NAMES.map((name) => [name, new Queue(name, { connection: bullRedis })]),
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

  // Single subscription for all gtarp.> events.
  // autoAck: false because we ack manually after dedup check.
  const sub = await bus.subscribe(
    'gtarp.>',
    async (evt: DomainEvent, msg) => {
      const subject = msg.subject;
      eventsReceivedTotal.inc({ subject });

      // Redis dedup: SET NX with 24-hour TTL.
      const dedupKey = `event:${evt.id}`;
      const isNew = await dedupRedis.set(dedupKey, '1', 'EX', 86400, 'NX');
      if (!isNew) {
        eventsDedupedTotal.inc();
        msg.ack();
        return;
      }

      // Fan out to every consumer that subscribed to this subject.
      const matchingConsumers = getConsumersForSubject(subject);
      for (const consumer of matchingConsumers) {
        const queue = queues.get(consumer.name);
        if (queue) {
          // jobId provides BullMQ-level dedup as a secondary safeguard.
          await queue.add(evt.type, evt, {
            jobId: `${consumer.name}:${evt.id}`,
          });
          jobsEnqueuedTotal.inc({ queue: consumer.name });
          const counts = await queue.getJobCounts('waiting', 'active');
          queueDepthGauge.set(
            { queue: consumer.name },
            (counts['waiting'] ?? 0) + (counts['active'] ?? 0),
          );
        }
      }

      msg.ack();
    },
    { durableName: 'bridge-main', deliverPolicy: 'new', autoAck: false },
  );

  return {
    async close() {
      sub.close();
      await Promise.all(workers.map((w) => w.close()));
      await Promise.all([...queues.values()].map((q) => q.close()));
      await bus.close();
      dedupRedis.disconnect();
      bullRedis.disconnect();
    },
  };
}
