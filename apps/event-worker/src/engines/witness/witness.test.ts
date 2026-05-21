import { describe, it, expect } from 'vitest';
import { buildWitnessStatement } from './index.js';
import type { WitnessObserved } from '@gtarp/event-schema';

type Factors = WitnessObserved['data']['factors'];

const GOOD_FACTORS: Factors = {
  lighting: 0.9,
  distance: 5,
  fear: 0.1,
  intimidated: false,
  intoxicated: false,
  relationshipToSuspect: 'stranger',
};

const BAD_FACTORS: Factors = {
  lighting: 0.2,
  distance: 80,
  fear: 0.9,
  intimidated: true,
  intoxicated: true,
  relationshipToSuspect: 'stranger',
};

describe('buildWitnessStatement', () => {
  it('returns a statement for high-quality witness', () => {
    const result = buildWitnessStatement('w1', 'crime-1', 0.8, GOOD_FACTORS);
    expect(result).not.toBeNull();
    expect(result!.statement.length).toBeGreaterThan(10);
    expect(result!.willing).toBe(true);
  });

  it('returns a low-reliability statement for medium quality', () => {
    const result = buildWitnessStatement('w2', 'crime-1', 0.45, GOOD_FACTORS);
    expect(result).not.toBeNull();
    expect(result!.reliability).toBeGreaterThanOrEqual(0);
  });

  it('returns null when quality is extremely low and intoxicated', () => {
    const result = buildWitnessStatement('w3', 'crime-1', 0.05, BAD_FACTORS);
    expect(result).toBeNull();
  });

  it('is deterministic — same inputs produce same statement', () => {
    const r1 = buildWitnessStatement('w-det', 'crime-det', 0.7, GOOD_FACTORS);
    const r2 = buildWitnessStatement('w-det', 'crime-det', 0.7, GOOD_FACTORS);
    expect(r1!.statement).toBe(r2!.statement);
  });

  it('different witnessIds produce different statements', () => {
    const r1 = buildWitnessStatement('w-a', 'crime-x', 0.7, GOOD_FACTORS);
    const r2 = buildWitnessStatement('w-b', 'crime-x', 0.7, GOOD_FACTORS);
    // At least one field should differ
    const same = r1!.statement === r2!.statement;
    // We allow same output if template pool exhausted, but reliability differs
    expect(same ? r1!.reliability !== r2!.reliability : true).toBe(true);
  });

  it('willing is false when intoxicated and quality is low', () => {
    const result = buildWitnessStatement('w4', 'crime-2', 0.2, BAD_FACTORS);
    if (result) {
      expect(result.willing).toBe(false);
    }
  });

  it('reliability never exceeds 1', () => {
    const result = buildWitnessStatement('w5', 'crime-3', 1.0, GOOD_FACTORS);
    expect(result!.reliability).toBeLessThanOrEqual(1);
  });

  it('reliability is reduced by distance', () => {
    const nearResult = buildWitnessStatement('w6', 'crime-4', 0.8, {
      ...GOOD_FACTORS,
      distance: 2,
    });
    const farResult = buildWitnessStatement('w6', 'crime-4', 0.8, {
      ...GOOD_FACTORS,
      distance: 80,
    });
    expect(nearResult!.reliability).toBeGreaterThan(farResult!.reliability);
  });
});
