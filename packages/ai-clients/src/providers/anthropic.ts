import Anthropic from '@anthropic-ai/sdk';
import type { TextProvider, GenerationRequest, GenerationResult } from '../index.js';

export interface AnthropicGenerationResult extends GenerationResult {
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM: number;
  cacheWritePerM: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-haiku-4-5-20251001': { inputPerM: 0.25, outputPerM: 1.25, cacheReadPerM: 0.03, cacheWritePerM: 0.30 },
  'claude-sonnet-4-6':        { inputPerM: 3.00, outputPerM: 15.00, cacheReadPerM: 0.30, cacheWritePerM: 3.75 },
  'claude-opus-4-7':          { inputPerM: 15.00, outputPerM: 75.00, cacheReadPerM: 1.50, cacheWritePerM: 18.75 },
};

function resolveModel(tier: GenerationRequest['tier']): string {
  switch (tier) {
    case 0: return 'claude-haiku-4-5-20251001';
    case 1: return 'claude-haiku-4-5-20251001';
    case 2: return 'claude-sonnet-4-6';
    case 3: return 'claude-opus-4-7';
  }
}

function calcCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-haiku-4-5-20251001']!;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerM +
    (outputTokens / 1_000_000) * pricing.outputPerM +
    (cacheCreationTokens / 1_000_000) * pricing.cacheWritePerM +
    (cacheReadTokens / 1_000_000) * pricing.cacheReadPerM
  );
}

interface AnthropicProviderOptions {
  apiKey?: string;
  maxRetries?: number;
}

export class AnthropicTextProvider implements TextProvider {
  private readonly client: Anthropic;

  constructor(opts: AnthropicProviderOptions = {}) {
    this.client = new Anthropic({
      apiKey: opts.apiKey ?? process.env['ANTHROPIC_API_KEY'],
      maxRetries: opts.maxRetries ?? 3,
    });
  }

  async generate(req: GenerationRequest): Promise<AnthropicGenerationResult> {
    const model = resolveModel(req.tier);

    const systemBlock = {
      type: 'text' as const,
      text: req.system,
      cache_control: { type: 'ephemeral' as const },
    };

    // Cast required: cache_control is valid API field but absent from SDK 0.32 TextBlockParam types.
    // exactOptionalPropertyTypes prevents indexed-access type assignment, so we use unknown cast.
    const system = [systemBlock] as unknown as Anthropic.TextBlockParam[];

    const baseParams = {
      model,
      max_tokens: req.maxTokens ?? 1024,
      system,
      messages: [{ role: 'user' as const, content: req.user }],
    };

    const params: Anthropic.MessageCreateParamsNonStreaming =
      req.temperature !== undefined
        ? { ...baseParams, temperature: req.temperature }
        : baseParams;

    const response = await this.client.messages.create(params);

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';

    const usage = response.usage;
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;
    // @ts-expect-error SDK typings may not include cache usage fields yet
    const cacheCreationTokens: number = (usage as Record<string, unknown>)['cache_creation_input_tokens'] as number ?? 0;
    // @ts-expect-error SDK typings may not include cache usage fields yet
    const cacheReadTokens: number = (usage as Record<string, unknown>)['cache_read_input_tokens'] as number ?? 0;

    return {
      text,
      provider: 'anthropic',
      model,
      tier: req.tier,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      costUsd: calcCost(model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens),
      cacheHit: cacheReadTokens > 0,
      cacheCreationTokens,
      cacheReadTokens,
    };
  }
}
