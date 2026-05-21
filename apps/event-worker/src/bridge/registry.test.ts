import { beforeEach, describe, expect, it } from 'vitest';
import type { Job } from 'bullmq';
import type { DomainEvent } from '@gtarp/event-schema';
import {
  CONSUMER_NAMES,
  _resetRegistryForTests,
  _subjectMatchesForTests as subjectMatches,
  getConsumersForSubject,
  getRegisteredConsumers,
  registerConsumer,
  type ConsumerRegistration,
} from './registry.js';

const noopHandler = async (_job: Job<DomainEvent>): Promise<void> => {
  /* no-op */
};

function reg(name: ConsumerRegistration['name'], subjects: string[]): ConsumerRegistration {
  return { name, subjects, handler: noopHandler };
}

describe('CONSUMER_NAMES', () => {
  it('contains every engine queue exactly once', () => {
    expect(CONSUMER_NAMES).toEqual([
      'reputation',
      'story',
      'media',
      'gang',
      'economy',
      'dispatch',
      'witness',
    ]);
    expect(new Set(CONSUMER_NAMES).size).toBe(CONSUMER_NAMES.length);
  });
});

describe('registerConsumer / getRegisteredConsumers', () => {
  beforeEach(() => _resetRegistryForTests());

  it('round-trips a registration', () => {
    const r = reg('reputation', ['gtarp.crime.>']);
    registerConsumer(r);
    expect(getRegisteredConsumers()).toEqual([r]);
  });

  it('replaces an existing registration with the same name', () => {
    registerConsumer(reg('story', ['gtarp.a']));
    registerConsumer(reg('story', ['gtarp.b']));
    const found = getRegisteredConsumers();
    expect(found).toHaveLength(1);
    expect(found[0]?.subjects).toEqual(['gtarp.b']);
  });
});

describe('getConsumersForSubject', () => {
  beforeEach(() => _resetRegistryForTests());

  it('returns only consumers whose subjects match', () => {
    registerConsumer(reg('reputation', ['gtarp.crime.>']));
    registerConsumer(reg('media', ['gtarp.media.*']));
    registerConsumer(reg('gang', ['gtarp.gang.joined']));

    const matched = getConsumersForSubject('gtarp.crime.committed')
      .map((c) => c.name)
      .sort();
    expect(matched).toEqual(['reputation']);
  });

  it('returns empty when nothing matches', () => {
    registerConsumer(reg('reputation', ['gtarp.crime.>']));
    expect(getConsumersForSubject('gtarp.media.captured')).toEqual([]);
  });
});

describe('subjectMatches (NATS wildcard semantics)', () => {
  it('matches exact subjects', () => {
    expect(subjectMatches('gtarp.crime.committed', 'gtarp.crime.committed')).toBe(true);
    expect(subjectMatches('gtarp.crime.committed', 'gtarp.crime.solved')).toBe(false);
  });

  it('* matches exactly one token', () => {
    expect(subjectMatches('gtarp.*.committed', 'gtarp.crime.committed')).toBe(true);
    expect(subjectMatches('gtarp.*.committed', 'gtarp.committed')).toBe(false);
    expect(subjectMatches('gtarp.*.committed', 'gtarp.crime.felony.committed')).toBe(false);
  });

  it('> matches one OR MORE remaining tokens and must be final', () => {
    expect(subjectMatches('gtarp.>', 'gtarp.crime.committed')).toBe(true);
    expect(subjectMatches('gtarp.>', 'gtarp.a.b.c.d')).toBe(true);
    // Bare prefix subject — `>` requires at least one trailing token.
    expect(subjectMatches('gtarp.>', 'gtarp')).toBe(false);
  });

  it('rejects when subject is shorter than non-wildcard pattern', () => {
    expect(subjectMatches('gtarp.crime.committed', 'gtarp.crime')).toBe(false);
  });

  it('rejects when subject is longer than non-wildcard pattern', () => {
    expect(subjectMatches('gtarp.crime', 'gtarp.crime.committed')).toBe(false);
  });
});
