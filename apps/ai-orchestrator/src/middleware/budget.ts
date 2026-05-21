import type { FastifyRequest, FastifyReply } from 'fastify';
import type { BudgetChecker } from '../router.js';
import type { AiTier } from '@gtarp/shared-types';

declare module 'fastify' {
  interface FastifyRequest {
    budgetCtx?: {
      effectiveTier: AiTier;
      playerId: string | undefined;
      degraded: boolean;
    };
  }
}

export interface BudgetMiddlewareOptions {
  budgetChecker: BudgetChecker;
  /** Header carrying the player ID. Defaults to 'x-player-id'. */
  playerIdHeader?: string;
}

function isAiTier(v: unknown): v is AiTier {
  return v === 0 || v === 1 || v === 2 || v === 3;
}

const ESTIMATED_TOKENS = 1024;

export function createBudgetMiddleware(opts: BudgetMiddlewareOptions) {
  // Fastify lowercases incoming header names, so the lookup key must be
  // lowercase even if the caller passes a mixed-case header name.
  const headerName = (opts.playerIdHeader ?? 'x-player-id').toLowerCase();

  return async function budgetGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    // Extract tier from parsed body (Fastify parses before preHandlers).
    // Default to tier 0 per ADR-0004 — a malformed body must NOT accidentally
    // authorise paid model usage.
    const body = request.body as Record<string, unknown> | null | undefined;
    const rawTier: unknown = body != null ? body['tier'] : undefined;
    const requestedTier: AiTier = isAiTier(rawTier) ? rawTier : 0;

    // Extract playerId from header
    const rawPlayerId = request.headers[headerName];
    const playerId = typeof rawPlayerId === 'string' ? rawPlayerId : undefined;

    let effectiveTier = requestedTier;
    let degraded = false;

    // Check server budget. When over budget, fall ALL the way to tier 0
    // (templates) — stepping 3→2 or 2→1 still spends paid tokens and would
    // not actually enforce the ceiling.
    if (effectiveTier > 0) {
      const serverOk = await opts.budgetChecker.checkServer(ESTIMATED_TOKENS);
      if (!serverOk) {
        effectiveTier = 0;
        degraded = true;
      }
    }

    // Check player budget — same hard-fallback to tier 0.
    if (playerId !== undefined && effectiveTier > 0) {
      const playerOk = await opts.budgetChecker.checkPlayer(playerId, ESTIMATED_TOKENS);
      if (!playerOk) {
        effectiveTier = 0;
        degraded = true;
      }
    }

    request.budgetCtx = { effectiveTier, playerId, degraded };
  };
}
