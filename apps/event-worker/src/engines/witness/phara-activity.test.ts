import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent, PharaActivity } from '@gtarp/event-schema';
import type { EventBus } from '@gtarp/event-bus';
import type { Redis } from 'ioredis';
import type { Job } from 'bullmq';
import { initWitnessEngine, witnessConsumer } from './index.js';

function makePharaActivity(activityType: PharaActivity['data']['activityType']): PharaActivity {
  return {
    id: 'evt-phara-1',
    type: 'phara.activity',
    version: 1,
    occurredAt: '2026-01-01T00:00:00Z',
    data: {
      activityId: 'activity-1',
      activityType,
      pharaRef: 'phara#001',
      location: { x: 10, y: 20, z: 5, province: 'GP', area: 'Hillbrow' },
    },
  };
}

function setupDeps() {
  const bus: EventBus = {
    publish: vi.fn(async () => ({ seq: 1 })),
    subscribe: vi.fn(async () => ({ close: () => {} })),
    ensureStream: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const redis = { set: vi.fn(), del: vi.fn() } as unknown as Redis;
  initWitnessEngine({ redis, bus });
  return bus;
}

async function runHandler(event: PharaActivity, bus: EventBus): Promise<void> {
  const job = { data: event } as Job<DomainEvent>;
  await witnessConsumer.handler(job);
  expect(bus.publish).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'witness.statement' }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('witnessConsumer — phara.activity injection', () => {
  it('publishes witness.observed for mugging', async () => {
    const bus = setupDeps();
    const evt = makePharaActivity('mugging');
    await runHandler(evt, bus);

    expect(bus.publish).toHaveBeenCalledTimes(1);
    const published = (bus.publish as ReturnType<typeof vi.fn>).mock.calls[0]![0] as DomainEvent;
    expect(published.type).toBe('witness.observed');
    if (published.type !== 'witness.observed') {
      throw new Error('Expected witness.observed');
    }
    expect(published.data.crimeId).toBe(evt.data.activityId);
    expect(published.data.witnessId).toMatch(/^phara-[a-f0-9]{12}$/);
  });

  it('publishes witness.observed for dealing_proximity', async () => {
    const bus = setupDeps();
    const evt = makePharaActivity('dealing_proximity');
    await runHandler(evt, bus);

    expect(bus.publish).toHaveBeenCalledTimes(1);
    const published = (bus.publish as ReturnType<typeof vi.fn>).mock.calls[0]![0] as DomainEvent;
    expect(published.type).toBe('witness.observed');
    if (published.type !== 'witness.observed') {
      throw new Error('Expected witness.observed');
    }
    expect(published.data.crimeId).toBe(evt.data.activityId);
  });

  it('skips injection for overdose', async () => {
    const bus = setupDeps();
    const evt = makePharaActivity('overdose');
    await runHandler(evt, bus);
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('skips injection for harassment', async () => {
    const bus = setupDeps();
    const evt = makePharaActivity('harassment');
    await runHandler(evt, bus);
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('hashes witnessId when pharaRef has no alphanumerics', async () => {
    const bus = setupDeps();
    const evt = makePharaActivity('mugging');
    evt.data.pharaRef = '---';
    await runHandler(evt, bus);

    const published = (bus.publish as ReturnType<typeof vi.fn>).mock.calls[0]![0] as DomainEvent;
    expect(published.type).toBe('witness.observed');
    if (published.type !== 'witness.observed') {
      throw new Error('Expected witness.observed');
    }
    expect(published.data.witnessId).toMatch(/^phara-[a-f0-9]{12}$/);
  });
});
