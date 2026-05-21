import { describe, it, expect } from 'vitest';
import { scoreEvent, type ReputationDelta } from './scoring.js';
import type { DomainEvent } from '@gtarp/event-schema';

// ── Helpers ──────────────────────────────────────────────────────────────────

function crimeEvent(overrides: Partial<DomainEvent['data'] & object> = {}): DomainEvent {
  return {
    id: 'evt-001',
    type: 'crime.committed',
    version: 1,
    occurredAt: '2026-01-01T00:00:00Z',
    data: {
      crimeId: 'crime-001',
      crimeType: 'robbery',
      severity: 'serious',
      perpetrators: ['player-1', 'player-2'],
      victims: [],
      location: { x: 0, y: 0, z: 0, province: 'GP', area: 'Sandton' },
      witnessed: false,
      witnessIds: [],
      ...overrides,
    },
  } as DomainEvent;
}

function pharaEvent(
  activityType: 'mugging' | 'overdose' | 'harassment' | 'dealing_proximity',
): DomainEvent {
  return {
    id: 'evt-phara-1',
    type: 'phara.activity',
    version: 1,
    occurredAt: '2026-01-01T00:00:00Z',
    data: {
      activityId: 'activity-1',
      activityType,
      pharaRef: 'phara-123',
      location: { x: 0, y: 0, z: 0, province: 'GP', area: 'Hillbrow' },
    },
  } as DomainEvent;
}

// ── crime.committed ───────────────────────────────────────────────────────────

describe('scoreEvent — crime.committed', () => {
  it('severity=serious: +25 per perp, +5 area criminal, -5 area safety', () => {
    const deltas = scoreEvent(crimeEvent());

    expect(deltas).toContainEqual<ReputationDelta>({ playerId: 'player-1', delta: 25 });
    expect(deltas).toContainEqual<ReputationDelta>({ playerId: 'player-2', delta: 25 });
    expect(deltas).toContainEqual<ReputationDelta>({
      area: 'Sandton',
      axis: 'criminal',
      delta: 5,
    });
    expect(deltas).toContainEqual<ReputationDelta>({
      area: 'Sandton',
      axis: 'safety',
      delta: -5,
    });
    expect(deltas).toHaveLength(4); // 2 perps + 2 area deltas
  });

  it('severity=serious with one perp: three deltas total', () => {
    const deltas = scoreEvent(crimeEvent({ perpetrators: ['player-1'] } as never));
    expect(deltas).toHaveLength(3);
  });

  it('severity=minor: empty array', () => {
    expect(scoreEvent(crimeEvent({ severity: 'minor' } as never))).toEqual([]);
  });

  it('severity=petty: empty array', () => {
    expect(scoreEvent(crimeEvent({ severity: 'petty' } as never))).toEqual([]);
  });

  it('severity=major: empty array', () => {
    expect(scoreEvent(crimeEvent({ severity: 'major' } as never))).toEqual([]);
  });

  it('severity=capital: empty array', () => {
    expect(scoreEvent(crimeEvent({ severity: 'capital' } as never))).toEqual([]);
  });
});

// ── arrest.made ───────────────────────────────────────────────────────────────

describe('scoreEvent — arrest.made', () => {
  const event: DomainEvent = {
    id: 'evt-002',
    type: 'arrest.made',
    version: 1,
    occurredAt: '2026-01-01T00:00:00Z',
    data: {
      suspectId: 'suspect-1',
      officerId: 'officer-1',
      charges: ['robbery'],
      location: { x: 0, y: 0, z: 0, province: 'GP', area: 'CBD' },
    },
  };

  it('-10 to suspect, +10 to officer', () => {
    const deltas = scoreEvent(event);
    expect(deltas).toHaveLength(2);
    expect(deltas).toContainEqual<ReputationDelta>({ playerId: 'suspect-1', delta: -10 });
    expect(deltas).toContainEqual<ReputationDelta>({ playerId: 'officer-1', delta: 10 });
  });
});

// ── bribe.accepted ────────────────────────────────────────────────────────────

describe('scoreEvent — bribe.accepted', () => {
  const event: DomainEvent = {
    id: 'evt-003',
    type: 'bribe.accepted',
    version: 1,
    occurredAt: '2026-01-01T00:00:00Z',
    data: {
      payerId: 'payer-1',
      receiverId: 'receiver-1',
      amount: 5000,
      purpose: 'drop charges',
    },
  };

  it('+5 corruption, -5 integrity for receiver', () => {
    const deltas = scoreEvent(event);
    expect(deltas).toHaveLength(2);
    expect(deltas).toContainEqual<ReputationDelta>({
      playerId: 'receiver-1',
      axis: 'corruption',
      delta: 5,
    });
    expect(deltas).toContainEqual<ReputationDelta>({
      playerId: 'receiver-1',
      axis: 'integrity',
      delta: -5,
    });
  });

  it('payer is not affected', () => {
    const deltas = scoreEvent(event);
    expect(deltas.every((d) => d.playerId !== 'payer-1')).toBe(true);
  });
});

// ── territory.lost ────────────────────────────────────────────────────────────

describe('scoreEvent — territory.lost', () => {
  const event: DomainEvent = {
    id: 'evt-004',
    type: 'territory.lost',
    version: 1,
    occurredAt: '2026-01-01T00:00:00Z',
    data: {
      territoryId: 'turf-001',
      fromGang: 'gang-losers',
      toGang: 'gang-winners',
      cause: 'raid',
    },
  };

  it('-30 losing gang, +30 winning gang', () => {
    const deltas = scoreEvent(event);
    expect(deltas).toHaveLength(2);
    expect(deltas).toContainEqual<ReputationDelta>({ gangId: 'gang-losers', delta: -30 });
    expect(deltas).toContainEqual<ReputationDelta>({ gangId: 'gang-winners', delta: 30 });
  });
});

// ── business.robbed ───────────────────────────────────────────────────────────

describe('scoreEvent — business.robbed', () => {
  function robbedEvent(cashTaken: number): DomainEvent {
    return {
      id: 'evt-005',
      type: 'business.robbed',
      version: 1,
      occurredAt: '2026-01-01T00:00:00Z',
      data: { businessId: 'biz-001', crimeId: 'crime-002', cashTaken },
    };
  }

  it('always returns -10 stability for business (keyed by businessId, not area)', () => {
    const deltas = scoreEvent(robbedEvent(0));
    expect(deltas).toContainEqual<ReputationDelta>({
      businessId: 'biz-001',
      axis: 'stability',
      delta: -10,
    });
  });

  it('returns only the stability delta (perp bonus handled by engine)', () => {
    expect(scoreEvent(robbedEvent(50_000))).toHaveLength(1);
  });

  it('cashTaken=0 → only stability delta', () => {
    expect(scoreEvent(robbedEvent(0))).toHaveLength(1);
  });

  it('cashTaken=100000 → only stability delta (perp bonus is engine concern)', () => {
    const deltas = scoreEvent(robbedEvent(100_000));
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({ axis: 'stability', delta: -10 });
  });
});

// ── phara.activity ─────────────────────────────────────────────────────────────

describe('scoreEvent — phara.activity', () => {
  it('mugging: -4 safety, +2 criminal', () => {
    const deltas = scoreEvent(pharaEvent('mugging'));
    expect(deltas).toContainEqual<ReputationDelta>({ area: 'Hillbrow', axis: 'safety', delta: -4 });
    expect(deltas).toContainEqual<ReputationDelta>({
      area: 'Hillbrow',
      axis: 'criminal',
      delta: 2,
    });
    expect(deltas).toHaveLength(2);
  });

  it('overdose: -3 safety, -2 stability', () => {
    const deltas = scoreEvent(pharaEvent('overdose'));
    expect(deltas).toContainEqual<ReputationDelta>({ area: 'Hillbrow', axis: 'safety', delta: -3 });
    expect(deltas).toContainEqual<ReputationDelta>({
      area: 'Hillbrow',
      axis: 'stability',
      delta: -2,
    });
    expect(deltas).toHaveLength(2);
  });

  it('harassment: -1 safety', () => {
    const deltas = scoreEvent(pharaEvent('harassment'));
    expect(deltas).toContainEqual<ReputationDelta>({ area: 'Hillbrow', axis: 'safety', delta: -1 });
    expect(deltas).toHaveLength(1);
  });

  it('dealing_proximity: +1 criminal', () => {
    const deltas = scoreEvent(pharaEvent('dealing_proximity'));
    expect(deltas).toContainEqual<ReputationDelta>({
      area: 'Hillbrow',
      axis: 'criminal',
      delta: 1,
    });
    expect(deltas).toHaveLength(1);
  });
});

// ── unhandled event types ─────────────────────────────────────────────────────

describe('scoreEvent — unhandled event types', () => {
  it('family.formed → empty array', () => {
    const event: DomainEvent = {
      id: 'evt-006',
      type: 'family.formed',
      version: 1,
      occurredAt: '2026-01-01T00:00:00Z',
      data: { familyId: 'fam-1', foundingMemberIds: ['p-1'], surname: 'Dlamini' },
    };
    expect(scoreEvent(event)).toEqual([]);
  });

  it('dispatch.requested → empty array', () => {
    const event: DomainEvent = {
      id: 'evt-007',
      type: 'dispatch.requested',
      version: 1,
      occurredAt: '2026-01-01T00:00:00Z',
      data: {
        incidentId: 'inc-1',
        severity: 'major',
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'Soweto' },
        summary: 'shots fired',
      },
    };
    expect(scoreEvent(event)).toEqual([]);
  });
});
