import { createHash } from 'node:crypto';
import type { L1Cache, CacheEntry } from './types.js';

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, exSeconds: number): Promise<void>;
}

export interface CacheKeyInput {
  provider: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_TTL = 86400;
const KEY_PREFIX = 'aicache:l1:';

export function buildCacheKey(input: CacheKeyInput): string {
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        provider: input.provider,
        model: input.model,
        system: input.system,
        user: input.user,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
      }),
    )
    .digest('hex');
  return `${KEY_PREFIX}${hash}`;
}

export class RedisL1Cache implements L1Cache {
  constructor(private readonly redis: RedisClient) {}

  async get(key: string): Promise<CacheEntry | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as CacheEntry;
    } catch {
      return null;
    }
  }

  async set(key: string, entry: CacheEntry, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    await this.redis.set(key, JSON.stringify(entry), ttlSeconds);
  }
}
