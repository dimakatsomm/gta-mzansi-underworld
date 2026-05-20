import { afterEach, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import { Queue, Worker } from 'bullmq';
import type { DomainEvent } from '@gtarp/event-schema';
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

async function checkRedis(): Promise<string | null> {
  const redis = new Redis(REDIS_URL, { lazyConnect: true, connectTimeout: 1000 });
  try {
    await redis.connect();
    await redis.ping();
    return null;
  } catch {
    return `Redis not reachable at ${REDIS_URL}`;
  } finally {
    redis.disconnect();
  }
}

describe('bridge idempotency', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0)) {
      try {
        await fn();
      } catch {
        /* best effort */
      }
    }
  });

  it('invokes handler exactly once when the same event id is submitted twice', async () => {
    const infraErr = await checkRedis();
    if (infraErr) {
      console.warn(`[bridge.test] Skipping — ${infraErr}`);
      return;
    }

    const runId = randomUUID().slice(0, 8);
    const queueName = `test-idem-${runId}`;

    const dedupRedis = new Redis(REDIS_URL);
    cleanups.push(async () => {
      dedupRedis.disconnect();
    });

    const bullRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    cleanups.push(async () => {
      bullRedis.disconnect();
    });

    const queue = new Queue<DomainEvent>(queueName, { connection: bullRedis });
    cleanups.push(async () => {
      await queue.obliterate({ force: true });
      await queue.close();
    });

    const eventId = randomUUID();
    const event: DomainEvent = {
      id: eventId,
      type: 'crime.committed',
      version: 1,
      occurredAt: new Date().toISOString(),
      data: {
        crimeId: randomUUID(),
        crimeType: 'robbery',
        severity: 'minor',
        perpetrators: ['player-1'],
        victims: [],
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'Johannesburg' },
        witnessed: false,
        witnessIds: [],
      },
    };

    /** Mirrors the bridge dedup-and-enqueue logic. */
    async function enqueueIfNew(evt: DomainEvent): Promise<void> {
      const isNew = await dedupRedis.set(`event:${evt.id}`, '1', 'EX', 86400, 'NX');
      if (!isNew) return;
      await queue.add(evt.type, evt, { jobId: `${queueName}:${evt.id}` });
    }

    // Submit the same event twice — only the first should result in a job.
    await enqueueIfNew(event);
    await enqueueIfNew(event);

    let invocationCount = 0;
    const worker = new Worker<DomainEvent>(
      queueName,
      async (_job: Job<DomainEvent>) => {
        invocationCount++;
      },
      { connection: bullRedis },
    );
    cleanups.push(async () => {
      await worker.close();
    });

    // Allow up to 3 s for the worker to process.
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));

    // Clean up dedup key so subsequent runs aren't affected.
    await dedupRedis.del(`event:${eventId}`);

    expect(invocationCount).toBe(1);
  }, 10_000);
});
