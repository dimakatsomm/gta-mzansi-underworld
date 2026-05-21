import { describe, it, expect, vi } from 'vitest';
import { buildCacheKey, RedisL1Cache } from './l1.js';
import { NoopL2Cache, SemanticL2Cache } from './l2.js';
import type { CacheKeyInput, RedisClient } from './l1.js';
import type { VectorStore, EmbeddingClient } from './l2.js';
import type { CacheEntry } from './types.js';

function makeEntry(): CacheEntry {
  return {
    result: {
      text: 'Test response',
      provider: 'template',
      model: 'template-v1',
      tier: 0,
      promptTokens: 10,
      completionTokens: 5,
      costUsd: 0,
      cacheHit: false,
    },
    storedAt: Date.now(),
  };
}

describe('buildCacheKey', () => {
  it('is deterministic — same input produces same key', () => {
    const input: CacheKeyInput = {
      provider: 'openai',
      model: 'gpt-4',
      system: 'You are a dispatcher.',
      user: 'What happened in Hillbrow?',
    };
    expect(buildCacheKey(input)).toBe(buildCacheKey(input));
  });

  it('different inputs produce different keys', () => {
    const base: CacheKeyInput = {
      provider: 'openai',
      model: 'gpt-4',
      system: 'sys',
      user: 'user A',
    };
    const changed: CacheKeyInput = { ...base, user: 'user B' };
    expect(buildCacheKey(base)).not.toBe(buildCacheKey(changed));
  });

  it('includes optional fields in key calculation', () => {
    const base: CacheKeyInput = { provider: 'openai', model: 'gpt-4', system: 's', user: 'u' };
    const withTemp: CacheKeyInput = { ...base, temperature: 0.7 };
    expect(buildCacheKey(base)).not.toBe(buildCacheKey(withTemp));
  });
});

describe('RedisL1Cache', () => {
  function makeRedis(stored: Map<string, string> = new Map()): RedisClient {
    return {
      get: vi.fn(async (key: string) => stored.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        stored.set(key, value);
      }),
    };
  }

  it('returns null on cache miss', async () => {
    const redis = makeRedis();
    const cache = new RedisL1Cache(redis);
    const result = await cache.get('aicache:l1:missing');
    expect(result).toBeNull();
  });

  it('returns parsed entry on cache hit', async () => {
    const entry = makeEntry();
    const stored = new Map([['aicache:l1:key1', JSON.stringify(entry)]]);
    const redis = makeRedis(stored);
    const cache = new RedisL1Cache(redis);
    const result = await cache.get('aicache:l1:key1');
    expect(result).toEqual(entry);
  });

  it('returns null when stored value is invalid JSON', async () => {
    const stored = new Map([['aicache:l1:bad', 'not-json{']]);
    const redis = makeRedis(stored);
    const cache = new RedisL1Cache(redis);
    expect(await cache.get('aicache:l1:bad')).toBeNull();
  });

  it('stores entry with TTL via set()', async () => {
    const redisMock: RedisClient = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
    };
    const cache = new RedisL1Cache(redisMock);
    const entry = makeEntry();
    await cache.set('aicache:l1:k', entry, 3600);
    expect(redisMock.set).toHaveBeenCalledWith('aicache:l1:k', JSON.stringify(entry), 3600);
  });
});

describe('NoopL2Cache', () => {
  it('find() always returns null', async () => {
    const cache = new NoopL2Cache();
    const result = await cache.find('any prompt', 0.9);
    expect(result).toBeNull();
  });

  it('store() resolves without throwing', async () => {
    const cache = new NoopL2Cache();
    await expect(cache.store('prompt', makeEntry())).resolves.toBeUndefined();
  });
});

describe('SemanticL2Cache', () => {
  function makeVectorStore(
    hit: { entry: CacheEntry; score: number } | null,
  ): VectorStore {
    return {
      findSimilar: vi.fn(async () => hit),
      upsert: vi.fn(async () => undefined),
    };
  }

  function makeEmbedder(): EmbeddingClient {
    return {
      embed: vi.fn(async () => [0.1, 0.2, 0.3]),
    };
  }

  it('returns entry when score >= threshold', async () => {
    const entry = makeEntry();
    const vectorStore = makeVectorStore({ entry, score: 0.95 });
    const cache = new SemanticL2Cache({ vectorStore, embedder: makeEmbedder(), threshold: 0.92 });
    const result = await cache.find('Hillbrow hijack', 0.92);
    expect(result).toEqual(entry);
  });

  it('returns null when score < threshold', async () => {
    const entry = makeEntry();
    const vectorStore = makeVectorStore({ entry, score: 0.80 });
    const cache = new SemanticL2Cache({ vectorStore, embedder: makeEmbedder(), threshold: 0.92 });
    const result = await cache.find('Hillbrow hijack', 0.92);
    expect(result).toBeNull();
  });

  it('returns null when vector store has no result', async () => {
    const vectorStore = makeVectorStore(null);
    const cache = new SemanticL2Cache({ vectorStore, embedder: makeEmbedder() });
    expect(await cache.find('anything', 0.92)).toBeNull();
  });

  it('store() calls embedder and upserts', async () => {
    const vectorStore = makeVectorStore(null);
    const embedder = makeEmbedder();
    const cache = new SemanticL2Cache({ vectorStore, embedder });
    const entry = makeEntry();
    await cache.store('some prompt', entry);
    expect(embedder.embed).toHaveBeenCalledWith('some prompt');
    expect(vectorStore.upsert).toHaveBeenCalledWith([0.1, 0.2, 0.3], entry);
  });
});
