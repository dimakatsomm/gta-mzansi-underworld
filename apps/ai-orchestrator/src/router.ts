import type { AiTier } from '@gtarp/shared-types';
import type {
  GenerationRequest,
  GenerationResult,
  TextProvider,
  VoiceProvider,
  VoiceRequest,
  VoiceResult,
} from '@gtarp/ai-clients';

export interface RouterResult extends GenerationResult {
  usedTier: AiTier;
  requestedTier: AiTier;
  degraded: boolean;
}

export interface VoiceRouterResult extends VoiceResult {
  degraded: boolean;
}

export interface BudgetChecker {
  /** Returns true if within budget. */
  checkPlayer(playerId: string, tokens: number): Promise<boolean>;
  checkServer(tokens: number): Promise<boolean>;
  recordUsage(playerId: string | undefined, tokens: number): Promise<void>;
}

export interface UsageLogger {
  log(entry: AiUsageEntry): Promise<void>;
}

export interface AiUsageEntry {
  provider: string;
  model: string;
  tier: number;
  purpose: string;
  promptTokens: number;
  completionTokens: number;
  audioSeconds?: number;
  costUsd: number;
  cacheHit: boolean;
  cacheKey?: string;
}

export interface RouterDeps {
  textProviders: Map<AiTier, TextProvider>;
  voiceProviders: Map<string, VoiceProvider>;
  budgetChecker: BudgetChecker;
  usageLogger: UsageLogger;
}

export async function routeText(
  req: GenerationRequest,
  playerId: string | undefined,
  deps: RouterDeps,
): Promise<RouterResult> {
  const requestedTier = req.tier;
  const estimatedTokens = req.maxTokens ?? 1024;

  let effectiveTier = requestedTier;
  let degraded = false;

  // Budget exceeded → hard-fallback to tier 0 (templates). Stepping 3→2 or
  // 2→1 still spends paid tokens, so it would not actually enforce the
  // budget ceiling. BudgetChecker is token-only (no tier-cost map), so the
  // only safe degradation is the free tier.
  if (effectiveTier > 0) {
    const serverOk = await deps.budgetChecker.checkServer(estimatedTokens);
    if (!serverOk) {
      effectiveTier = 0;
      degraded = true;
    }
  }

  // Check player budget — same hard-fallback.
  if (playerId !== undefined && effectiveTier > 0) {
    const playerOk = await deps.budgetChecker.checkPlayer(playerId, estimatedTokens);
    if (!playerOk) {
      effectiveTier = 0;
      degraded = true;
    }
  }

  // Fall back to tier 0 if requested tier's provider is missing
  const provider = deps.textProviders.get(effectiveTier) ?? deps.textProviders.get(0);
  if (provider === undefined) {
    throw new Error(`No text provider available (tried tier ${effectiveTier} and tier 0)`);
  }

  const modifiedReq: GenerationRequest = { ...req, tier: effectiveTier };
  const result = await provider.generate(modifiedReq);

  const usageEntry: AiUsageEntry = {
    provider: result.provider,
    model: result.model,
    tier: result.tier,
    purpose: req.purpose,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    costUsd: result.costUsd,
    cacheHit: result.cacheHit,
  };
  if (req.cacheKey !== undefined) {
    usageEntry.cacheKey = req.cacheKey;
  }
  await deps.usageLogger.log(usageEntry);

  await deps.budgetChecker.recordUsage(playerId, result.promptTokens + result.completionTokens);

  return {
    ...result,
    usedTier: effectiveTier,
    requestedTier,
    degraded,
  };
}

/**
 * Thrown when a voice request would exceed server or player budget. Voice has
 * no tier-0 free fallback (TTS is inherently paid), so the only safe path is
 * to refuse the call. Per ADR-0004 this is an enforcing budget guard, not an
 * advisory flag.
 */
export class VoiceBudgetExceededError extends Error {
  constructor(public readonly scope: 'server' | 'player') {
    super(`Voice budget exceeded (${scope}); request denied`);
    this.name = 'VoiceBudgetExceededError';
  }
}

export async function routeVoice(
  req: VoiceRequest,
  playerId: string | undefined,
  providerKey: string,
  deps: RouterDeps,
): Promise<VoiceRouterResult> {
  const estimatedTokens = 1024;

  // Enforcing guard — refuse paid TTS when over budget. There is no free
  // voice fallback, so degraded=true cannot mean "proceed anyway".
  const serverOk = await deps.budgetChecker.checkServer(estimatedTokens);
  if (!serverOk) throw new VoiceBudgetExceededError('server');

  if (playerId !== undefined) {
    const playerOk = await deps.budgetChecker.checkPlayer(playerId, estimatedTokens);
    if (!playerOk) throw new VoiceBudgetExceededError('player');
  }

  const provider = deps.voiceProviders.get(providerKey);
  if (provider === undefined) {
    throw new Error(`No voice provider found for key: ${providerKey}`);
  }

  const result = await provider.speak(req);

  const usageEntry: AiUsageEntry = {
    provider: providerKey,
    model: providerKey,
    tier: 1,
    purpose: req.purpose,
    promptTokens: 0,
    completionTokens: 0,
    audioSeconds: result.durationSeconds,
    costUsd: result.costUsd,
    cacheHit: result.cacheHit,
  };
  if (req.cacheKey !== undefined) {
    usageEntry.cacheKey = req.cacheKey;
  }
  await deps.usageLogger.log(usageEntry);

  // Record an audio-second proxy so voice spend contributes to player budget.
  // Using durationSeconds * 50 ≈ tokens-equivalent (rough cost normalisation
  // matching ElevenLabs ~$0.03/min vs $0.001/1k tokens for Haiku).
  const audioTokenEquivalent = Math.ceil(result.durationSeconds * 50);
  await deps.budgetChecker.recordUsage(playerId, audioTokenEquivalent);

  return { ...result, degraded: false };
}
