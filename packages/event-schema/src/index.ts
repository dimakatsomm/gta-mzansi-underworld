import { z } from 'zod';

/**
 * Canonical event envelope. Every domain event extends this.
 * Schema versioning is per event type — bump `version` on breaking changes
 * and keep prior versions live until consumers migrate.
 */
export const EventEnvelope = z.object({
  id: z.string().uuid(),
  type: z.string(),
  version: z.number().int().min(1),
  occurredAt: z.string().datetime(),
  actor: z.string().optional(),
  correlationId: z.string().uuid().optional(),
});

const Geo = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  province: z.enum(['GP', 'WC', 'KZN', 'EC', 'NC', 'FS', 'NW', 'MP', 'LP']),
  area: z.string(),
});

const CrimeType = z.enum([
  'hijack',
  'robbery',
  'cit_robbery',
  'drug_deal',
  'counterfeit',
  'tender_fraud',
  'protection',
  'firearm_trafficking',
  'smuggling',
  'money_laundering',
  'corruption_bribe',
  'assault',
  'murder',
]);

const Severity = z.enum(['petty', 'minor', 'major', 'serious', 'capital']);

// --- Domain events ---

export const CrimeCommitted = EventEnvelope.extend({
  type: z.literal('crime.committed'),
  version: z.literal(1),
  data: z.object({
    crimeId: z.string().uuid(),
    crimeType: CrimeType,
    severity: Severity,
    perpetrators: z.array(z.string()).min(1),
    victims: z.array(z.string()).default([]),
    location: Geo,
    witnessed: z.boolean(),
    witnessIds: z.array(z.string()).default([]),
  }),
});

export const ArrestMade = EventEnvelope.extend({
  type: z.literal('arrest.made'),
  version: z.literal(1),
  data: z.object({
    suspectId: z.string(),
    officerId: z.string(),
    charges: z.array(CrimeType).min(1),
    location: Geo,
  }),
});

export const BribeAccepted = EventEnvelope.extend({
  type: z.literal('bribe.accepted'),
  version: z.literal(1),
  data: z.object({
    payerId: z.string(),
    receiverId: z.string(),
    amount: z.number().positive(),
    purpose: z.string(),
  }),
});

export const TerritoryLost = EventEnvelope.extend({
  type: z.literal('territory.lost'),
  version: z.literal(1),
  data: z.object({
    territoryId: z.string(),
    fromGang: z.string(),
    toGang: z.string(),
    cause: z.enum(['raid', 'attrition', 'alliance', 'police_pressure']),
  }),
});

export const BusinessRobbed = EventEnvelope.extend({
  type: z.literal('business.robbed'),
  version: z.literal(1),
  data: z.object({
    businessId: z.string(),
    crimeId: z.string().uuid(),
    cashTaken: z.number().nonnegative(),
  }),
});

export const FamilyFormed = EventEnvelope.extend({
  type: z.literal('family.formed'),
  version: z.literal(1),
  data: z.object({
    familyId: z.string(),
    foundingMemberIds: z.array(z.string()).min(1),
    surname: z.string(),
  }),
});

export const ChildBorn = EventEnvelope.extend({
  type: z.literal('child.born'),
  version: z.literal(1),
  data: z.object({
    familyId: z.string(),
    parentIds: z.array(z.string()).min(1),
    childId: z.string(),
  }),
});

export const DispatchRequested = EventEnvelope.extend({
  type: z.literal('dispatch.requested'),
  version: z.literal(1),
  data: z.object({
    incidentId: z.string().uuid(),
    severity: Severity,
    location: Geo,
    summary: z.string(),
    /** URL of synthesized voice audio. Optional — absent when voice synthesis is unavailable. */
    voiceUrl: z.string().optional(),
  }),
});

export const WitnessObserved = EventEnvelope.extend({
  type: z.literal('witness.observed'),
  version: z.literal(1),
  data: z.object({
    crimeId: z.string().uuid(),
    witnessId: z.string(),
    quality: z.number().min(0).max(1),
    factors: z.object({
      lighting: z.number().min(0).max(1),
      distance: z.number().nonnegative(),
      fear: z.number().min(0).max(1),
      intimidated: z.boolean(),
      intoxicated: z.boolean(),
      relationshipToSuspect: z.enum(['stranger', 'acquaintance', 'family', 'rival']),
    }),
  }),
});

export const WitnessStatement = EventEnvelope.extend({
  type: z.literal('witness.statement'),
  version: z.literal(1),
  data: z.object({
    crimeId: z.string().uuid(),
    witnessId: z.string(),
    /** Quality-adjusted statement text (SA-authentic English/Zulu/Afrikaans mix). */
    statement: z.string(),
    /** 0–1: how reliable is this statement (affected by all quality factors). */
    reliability: z.number().min(0).max(1),
    /** True when the witness is willing to provide official testimony. */
    willing: z.boolean(),
  }),
});

export const DomainEvent = z.discriminatedUnion('type', [
  CrimeCommitted,
  ArrestMade,
  BribeAccepted,
  TerritoryLost,
  BusinessRobbed,
  FamilyFormed,
  ChildBorn,
  DispatchRequested,
  WitnessObserved,
  WitnessStatement,
]);

export type DomainEvent = z.infer<typeof DomainEvent>;
export type CrimeCommitted = z.infer<typeof CrimeCommitted>;
export type ArrestMade = z.infer<typeof ArrestMade>;
export type BribeAccepted = z.infer<typeof BribeAccepted>;
export type TerritoryLost = z.infer<typeof TerritoryLost>;
export type BusinessRobbed = z.infer<typeof BusinessRobbed>;
export type FamilyFormed = z.infer<typeof FamilyFormed>;
export type ChildBorn = z.infer<typeof ChildBorn>;
export type DispatchRequested = z.infer<typeof DispatchRequested>;
export type WitnessObserved = z.infer<typeof WitnessObserved>;
export type WitnessStatement = z.infer<typeof WitnessStatement>;

export const SUBJECT_PREFIX = 'gtarp';
export const subjectFor = (type: DomainEvent['type']): string => `${SUBJECT_PREFIX}.${type}`;
