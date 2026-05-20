import type { DomainEvent } from '@gtarp/event-schema';
import type { Job } from 'bullmq';

export interface ConsumerRegistration {
  name: string;
  subjects: string[];
  handler: (job: Job<DomainEvent>) => Promise<void>;
}

export const CONSUMER_NAMES = [
  'reputation',
  'story',
  'media',
  'gang',
  'economy',
  'dispatch',
] as const;
export type ConsumerName = (typeof CONSUMER_NAMES)[number];

const registryMap = new Map<string, ConsumerRegistration>();

export function registerConsumer(reg: ConsumerRegistration): void {
  registryMap.set(reg.name, reg);
}

export function getRegisteredConsumers(): ConsumerRegistration[] {
  return [...registryMap.values()];
}

export function getConsumersForSubject(subject: string): ConsumerRegistration[] {
  return [...registryMap.values()].filter((r) =>
    r.subjects.some((s) => subjectMatches(s, subject)),
  );
}

/** Simple NATS wildcard matching: `>` matches everything, `*` matches one token. */
function subjectMatches(pattern: string, subject: string): boolean {
  if (pattern === subject) return true;
  const patParts = pattern.split('.');
  const subParts = subject.split('.');
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i] === '>') return true;
    if (patParts[i] === '*') continue;
    if (patParts[i] !== subParts[i]) return false;
  }
  return patParts.length === subParts.length;
}
