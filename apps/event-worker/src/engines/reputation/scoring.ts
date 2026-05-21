import type { DomainEvent } from '@gtarp/event-schema';

export interface ReputationDelta {
  /** Exactly one target entity field is set. */
  playerId?: string;
  gangId?: string;
  familyId?: string;
  /** Geographic area (e.g. 'Sandton'). Distinct from businessId. */
  area?: string;
  /** Business entity id (kept separate from area to avoid collision). */
  businessId?: string;
  /** Optional scoring axis (e.g. 'criminal', 'safety', 'corruption', 'integrity', 'stability'). */
  axis?: string;
  /** Amount to add to the current score (may be negative). */
  delta: number;
}

/**
 * Pure function — no I/O, no side effects.
 * Returns the reputation deltas derivable from event data alone.
 * Gang membership lookups and business perpetrator lookups require DB access
 * and are handled by the engine layer (index.ts).
 */
export function scoreEvent(event: DomainEvent): ReputationDelta[] {
  switch (event.type) {
    case 'crime.committed': {
      if (event.data.severity !== 'serious') return [];
      const deltas: ReputationDelta[] = [];
      // +25 notoriety to each perpetrator player.
      for (const perpId of event.data.perpetrators) {
        deltas.push({ playerId: perpId, delta: 25 });
      }
      // Area axes: criminal +5, safety -5.
      deltas.push({ area: event.data.location.area, axis: 'criminal', delta: 5 });
      deltas.push({ area: event.data.location.area, axis: 'safety', delta: -5 });
      // Gang +10 per perp requires membership lookup — handled in engine.
      return deltas;
    }

    case 'arrest.made':
      return [
        { playerId: event.data.suspectId, delta: -10 },
        { playerId: event.data.officerId, delta: 10 },
      ];

    case 'bribe.accepted':
      return [
        { playerId: event.data.receiverId, axis: 'corruption', delta: 5 },
        { playerId: event.data.receiverId, axis: 'integrity', delta: -5 },
      ];

    case 'territory.lost':
      return [
        { gangId: event.data.fromGang, delta: -30 },
        { gangId: event.data.toGang, delta: 30 },
      ];

    case 'business.robbed':
      // Business stability hit. Perp notoriety requires crimeId→CrimePerpetrator
      // lookup — handled in engine.
      return [{ businessId: event.data.businessId, axis: 'stability', delta: -10 }];

    case 'phara.activity': {
      const { activityType, location } = event.data;
      const area = location.area;
      switch (activityType) {
        case 'mugging':
          return [
            { area, axis: 'safety', delta: -4 },
            { area, axis: 'criminal', delta: 2 },
          ];
        case 'overdose':
          return [
            { area, axis: 'safety', delta: -3 },
            { area, axis: 'stability', delta: -2 },
          ];
        case 'harassment':
          return [{ area, axis: 'safety', delta: -1 }];
        case 'dealing_proximity':
          return [{ area, axis: 'criminal', delta: 1 }];
        default:
          return [];
      }
    }

    default:
      return [];
  }
}
