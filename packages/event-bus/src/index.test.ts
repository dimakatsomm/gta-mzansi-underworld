import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DomainEvent } from '@gtarp/event-schema';
import { connect, EventValidationError } from './index.js';

// Uses real NATS (from CI service or local)
// NATS_URL set in CI; falls back to nats://localhost:4222

describe('@gtarp/event-bus contract tests', () => {
  let bus: Awaited<ReturnType<typeof connect>>;

  beforeAll(async () => {
    bus = await connect();
    await bus.ensureStream();
  }, 30_000);

  afterAll(async () => {
    await bus.close();
  });

  it('round-trip: publish → subscribe → handler invoked → ack', async () => {
    const received: DomainEvent[] = [];

    const event: DomainEvent = {
      id: crypto.randomUUID(),
      type: 'crime.committed',
      version: 1,
      occurredAt: new Date().toISOString(),
      data: {
        crimeId: crypto.randomUUID(),
        crimeType: 'robbery',
        severity: 'serious',
        perpetrators: ['player-1'],
        victims: [],
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'hillbrow' },
        witnessed: false,
        witnessIds: [],
      },
    };

    await bus.subscribe(
      'gtarp.crime.committed',
      async (evt) => {
        received.push(evt);
      },
      { durableName: `test-round-trip-${Date.now()}` },
    );

    await bus.publish(event);

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (received.length > 0) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 5000);
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.id).toBe(event.id);
  }, 30_000);

  it('invalid event throws EventValidationError before hitting NATS', async () => {
    const invalidEvent = {
      id: 'not-a-uuid',
      type: 'crime.committed',
      version: 1,
    } as unknown as DomainEvent;
    await expect(bus.publish(invalidEvent)).rejects.toBeInstanceOf(EventValidationError);
  });
});
