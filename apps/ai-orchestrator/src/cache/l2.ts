import type { L2Cache, CacheEntry } from './types.js';

export interface VectorStore {
  findSimilar(
    embedding: number[],
    threshold: number,
  ): Promise<{ entry: CacheEntry; score: number } | null>;
  upsert(embedding: number[], entry: CacheEntry): Promise<void>;
}

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
}

const DEFAULT_THRESHOLD = 0.92;

export class SemanticL2Cache implements L2Cache {
  private readonly vectorStore: VectorStore;
  private readonly embedder: EmbeddingClient;
  private readonly threshold: number;

  constructor(deps: { vectorStore: VectorStore; embedder: EmbeddingClient; threshold?: number }) {
    this.vectorStore = deps.vectorStore;
    this.embedder = deps.embedder;
    this.threshold = deps.threshold ?? DEFAULT_THRESHOLD;
  }

  async find(userPrompt: string, threshold?: number): Promise<CacheEntry | null> {
    const effectiveThreshold = threshold ?? this.threshold;
    const embedding = await this.embedder.embed(userPrompt);
    const result = await this.vectorStore.findSimilar(embedding, effectiveThreshold);
    if (result === null) return null;
    if (result.score >= effectiveThreshold) return result.entry;
    return null;
  }

  async store(userPrompt: string, entry: CacheEntry): Promise<void> {
    const embedding = await this.embedder.embed(userPrompt);
    await this.vectorStore.upsert(embedding, entry);
  }
}

export class NoopL2Cache implements L2Cache {
  async find(_userPrompt: string, _threshold?: number): Promise<CacheEntry | null> {
    return null;
  }

  async store(_userPrompt: string, _entry: CacheEntry): Promise<void> {
    // no-op: semantic cache unavailable
  }
}
