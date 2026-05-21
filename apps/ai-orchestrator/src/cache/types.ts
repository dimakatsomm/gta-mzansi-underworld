import type { GenerationResult } from '@gtarp/ai-clients';

export interface CacheEntry {
  result: GenerationResult;
  storedAt: number; // Date.now()
}

export interface L1Cache {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry, ttlSeconds: number): Promise<void>;
}

export interface L2Cache {
  /**
   * Find a semantically similar cached entry. If `threshold` is omitted the
   * implementation uses its configured default (e.g. SemanticL2Cache's
   * deps.threshold).
   */
  find(userPrompt: string, threshold?: number): Promise<CacheEntry | null>;
  store(userPrompt: string, entry: CacheEntry): Promise<void>;
}
