import { describe, it, expect } from 'vitest';
import { CrimeCommitted, DomainEvent, WitnessStatement, subjectFor } from './index.js';

describe('event-schema', () => {
  it('parses a valid crime.committed event', () => {
    const evt = CrimeCommitted.parse({
      id: '00000000-0000-4000-8000-000000000001',
      type: 'crime.committed',
      version: 1,
      occurredAt: '2026-05-19T10:00:00.000Z',
      data: {
        crimeId: '00000000-0000-4000-8000-000000000002',
        crimeType: 'hijack',
        severity: 'major',
        perpetrators: ['player_a'],
        location: { x: 0, y: 0, z: 0, province: 'GP', area: 'hillbrow' },
        witnessed: true,
        witnessIds: ['npc_1'],
      },
    });
    expect(evt.data.crimeType).toBe('hijack');
  });

  it('rejects unknown event types in the union', () => {
    expect(() =>
      DomainEvent.parse({
        id: '00000000-0000-4000-8000-000000000003',
        type: 'crime.invented',
        version: 1,
        occurredAt: '2026-05-19T10:00:00.000Z',
        data: {},
      }),
    ).toThrow();
  });

  it('builds NATS subjects from event type', () => {
    expect(subjectFor('crime.committed')).toBe('gtarp.crime.committed');
  });
});

describe('WitnessStatement schema', () => {
  // Annotate with the Zod input type so TypeScript knows the shape and spread
  // operations compile. Parameters<parse>[0] resolves to `unknown` (Zod parses
  // any input) which breaks spread — use z.input<> or an explicit object literal.
  const VALID = {
    id: '00000000-0000-4000-8000-000000000010',
    type: 'witness.statement' as const,
    version: 1 as const,
    occurredAt: '2026-05-21T12:00:00.000Z',
    data: {
      crimeId: '00000000-0000-4000-8000-000000000011',
      witnessId: 'npc-abc123def456',
      statement: 'Eish, I saw everything from the spaza.',
      reliability: 0.72,
      willing: true,
    },
  };

  it('parses a valid witness.statement event', () => {
    const evt = WitnessStatement.parse(VALID);
    expect(evt.type).toBe('witness.statement');
    expect(evt.data.reliability).toBe(0.72);
    expect(evt.data.willing).toBe(true);
  });

  it('DomainEvent union routes witness.statement correctly', () => {
    const evt = DomainEvent.parse(VALID);
    expect(evt.type).toBe('witness.statement');
  });

  it('rejects reliability below 0', () => {
    expect(() =>
      WitnessStatement.parse({ ...VALID, data: { ...VALID.data, reliability: -0.01 } }),
    ).toThrow();
  });

  it('rejects reliability above 1', () => {
    expect(() =>
      WitnessStatement.parse({ ...VALID, data: { ...VALID.data, reliability: 1.01 } }),
    ).toThrow();
  });

  it('rejects missing witnessId', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { witnessId: _id, ...dataWithout } = VALID.data;
    expect(() => WitnessStatement.parse({ ...VALID, data: dataWithout })).toThrow();
  });
});
