import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenerationRequest } from '../index.js';

vi.mock('@anthropic-ai/sdk', () => {
  const mockMessagesCreate = vi.fn();

  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: mockMessagesCreate,
    },
  }));

  return { default: MockAnthropic, __mockMessagesCreate: mockMessagesCreate };
});

const anthropicMod = await import('@anthropic-ai/sdk');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mod = anthropicMod as any;
const mockMessagesCreate = mod.__mockMessagesCreate as ReturnType<typeof vi.fn>;

const { AnthropicTextProvider } = await import('./anthropic.js');

const baseReq: GenerationRequest = {
  purpose: 'gang-lore',
  tier: 1,
  system: 'You are a storyteller in Joburg.',
  user: 'Tell me about the streets.',
};

function makeResponse(overrides: Partial<{
  cacheCreationTokens: number;
  cacheReadTokens: number;
  inputTokens: number;
  outputTokens: number;
  content: string;
}> = {}) {
  const {
    cacheCreationTokens = 0,
    cacheReadTokens = 0,
    inputTokens = 50,
    outputTokens = 30,
    content = 'The streets are alive.',
  } = overrides;

  return {
    content: [{ type: 'text', text: content }],
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationTokens,
      cache_read_input_tokens: cacheReadTokens,
    },
  };
}

describe('AnthropicTextProvider', () => {
  beforeEach(() => {
    mockMessagesCreate.mockResolvedValue(makeResponse());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns AnthropicGenerationResult with cacheCreationTokens and cacheReadTokens', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeResponse({ cacheCreationTokens: 100, cacheReadTokens: 0 }),
    );
    const provider = new AnthropicTextProvider({ apiKey: 'test-key' });
    const result = await provider.generate(baseReq);

    expect(result.text).toBe('The streets are alive.');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.tier).toBe(1);
    expect(result.cacheCreationTokens).toBe(100);
    expect(result.cacheReadTokens).toBe(0);
    expect(result.cacheHit).toBe(false);
  });

  it('sets cacheHit=true and includes cache_read tokens in cost', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeResponse({ cacheCreationTokens: 0, cacheReadTokens: 500, inputTokens: 10, outputTokens: 20 }),
    );
    const provider = new AnthropicTextProvider({ apiKey: 'test-key' });
    const result = await provider.generate(baseReq);

    expect(result.cacheHit).toBe(true);
    expect(result.cacheReadTokens).toBe(500);
    // cost should include cache read charge (haiku: $0.03/M)
    const expectedCacheReadCost = (500 / 1_000_000) * 0.03;
    expect(result.costUsd).toBeGreaterThanOrEqual(expectedCacheReadCost);
  });

  it('includes cache_creation tokens in cost calculation', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeResponse({ cacheCreationTokens: 1_000_000, cacheReadTokens: 0, inputTokens: 0, outputTokens: 0 }),
    );
    const provider = new AnthropicTextProvider({ apiKey: 'test-key' });
    const result = await provider.generate(baseReq);

    // haiku cache_write = $0.30/M → 1M tokens = $0.30
    expect(result.costUsd).toBeCloseTo(0.30, 5);
  });

  it('sends system prompt with cache_control ephemeral', async () => {
    const provider = new AnthropicTextProvider({ apiKey: 'test-key' });
    await provider.generate(baseReq);

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            cache_control: { type: 'ephemeral' },
          }),
        ]),
      }),
    );
  });

  it('selects correct model per tier', async () => {
    const provider = new AnthropicTextProvider({ apiKey: 'test-key' });

    await provider.generate({ ...baseReq, tier: 2 });
    expect(mockMessagesCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    );

    await provider.generate({ ...baseReq, tier: 3 });
    expect(mockMessagesCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-7' }),
    );
  });
});
