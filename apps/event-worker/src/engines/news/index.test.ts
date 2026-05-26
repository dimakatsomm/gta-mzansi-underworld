import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent, DispatchRequested } from '@gtarp/event-schema';
import type { Job } from 'bullmq';

const { createNewsEventMock, registerConsumerMock } = vi.hoisted(() => ({
  createNewsEventMock: vi.fn(),
  registerConsumerMock: vi.fn(),
}));

vi.mock('@gtarp/db', () => ({
  getPrisma: () => ({
    newsEvent: {
      create: createNewsEventMock,
    },
  }),
}));

vi.mock('../../bridge/registry.js', () => ({
  registerConsumer: registerConsumerMock,
}));

import {
  _resetNewsEngineForTests,
  initNewsEngine,
  newsConsumer,
  registerNewsEngine,
} from './index.js';

type RedisLike = {
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

function buildDispatchRequested(
  overrides: Partial<DispatchRequested['data']> = {},
): DispatchRequested {
  return {
    id: '3d47f9c4-5212-4206-8172-9dc59d266797',
    type: 'dispatch.requested',
    version: 1,
    occurredAt: new Date().toISOString(),
    data: {
      incidentId: '58f9ff63-8831-46a4-aedb-df7826dbccff',
      severity: 'major',
      location: {
        x: 100,
        y: 200,
        z: 10,
        province: 'GP',
        area: 'yeoville',
      },
      summary: 'Dispatch summary',
      ...overrides,
    },
  };
}

describe('news engine', () => {
  let redis: RedisLike;

  beforeEach(() => {
    _resetNewsEngineForTests();
    createNewsEventMock.mockReset();
    registerConsumerMock.mockReset();

    redis = {
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    initNewsEngine({ redis: redis as never });
  });

  it('registerNewsEngine registers news consumer', () => {
    registerNewsEngine();
    expect(registerConsumerMock).toHaveBeenCalledTimes(1);
    expect(registerConsumerMock).toHaveBeenCalledWith(newsConsumer);
  });

  it('persists one NewsEvent when dispatch.requested is claimed', async () => {
    const evt = buildDispatchRequested();

    await newsConsumer.handler({ data: evt } as Job<DomainEvent>);

    expect(redis.set).toHaveBeenCalledWith(
      `news:incident:${evt.data.incidentId}`,
      '1',
      'EX',
      60 * 60 * 24,
      'NX',
    );
    expect(createNewsEventMock).toHaveBeenCalledTimes(1);

    const args = createNewsEventMock.mock.calls[0]?.[0] as {
      data: { headline: string; category: string; sourceEventIds: string[]; area: string | null };
    };
    expect(args.data.headline.length).toBeGreaterThan(0);
    expect(args.data.sourceEventIds).toEqual([evt.id]);
    expect(args.data.area).toBe('yeoville');
  });

  it('skips create when incident was already claimed', async () => {
    redis.set.mockResolvedValue(null);

    await newsConsumer.handler({ data: buildDispatchRequested() } as Job<DomainEvent>);

    expect(createNewsEventMock).not.toHaveBeenCalled();
  });

  it('releases idempotency key if prisma write fails', async () => {
    const evt = buildDispatchRequested();
    createNewsEventMock.mockRejectedValue(new Error('db failed'));

    await expect(newsConsumer.handler({ data: evt } as Job<DomainEvent>)).rejects.toThrow(
      'db failed',
    );

    expect(redis.del).toHaveBeenCalledWith(`news:incident:${evt.data.incidentId}`);
  });

  it('ignores non-dispatch events', async () => {
    const unrelated = {
      id: 'evt-1',
      type: 'crime.committed',
      version: 1,
      occurredAt: new Date().toISOString(),
      data: {
        crimeId: '58f9ff63-8831-46a4-aedb-df7826dbccff',
        perpetrators: ['p1'],
        severity: 'major',
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'cbd' },
      },
    } as unknown as DomainEvent;

    await newsConsumer.handler({ data: unrelated } as Job<DomainEvent>);

    expect(createNewsEventMock).not.toHaveBeenCalled();
  });
});
