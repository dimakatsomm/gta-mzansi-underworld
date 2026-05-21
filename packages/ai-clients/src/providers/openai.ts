import OpenAI from 'openai';
import type {
  TextProvider,
  VoiceProvider,
  GenerationRequest,
  GenerationResult,
  VoiceRequest,
  VoiceResult,
} from '../index.js';

const OPENAI_TTS_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

function resolveTextModel(tier: GenerationRequest['tier']): string {
  return tier <= 1 ? 'gpt-4o-mini' : 'gpt-4o';
}

function calcTextCost(model: string, promptTokens: number, completionTokens: number): number {
  if (model === 'gpt-4o-mini') {
    return (promptTokens / 1000) * 0.00015 + (completionTokens / 1000) * 0.0006;
  }
  return (promptTokens / 1000) * 0.0025 + (completionTokens / 1000) * 0.01;
}

interface OpenAIProviderOptions {
  apiKey?: string;
  logPrompts?: boolean;
  maxRetries?: number;
}

export class OpenAITextProvider implements TextProvider {
  private readonly client: OpenAI;
  private readonly logPrompts: boolean;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.logPrompts = opts.logPrompts ?? process.env['OPENAI_LOG_PROMPTS'] === 'true';
    this.client = new OpenAI({
      apiKey: opts.apiKey ?? process.env['OPENAI_API_KEY'],
      maxRetries: opts.maxRetries ?? 3,
    });
  }

  async generate(req: GenerationRequest): Promise<GenerationResult> {
    const model = resolveTextModel(req.tier);

    if (this.logPrompts) {
      console.log(`[OpenAITextProvider] purpose=${req.purpose}`);
    }

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    };

    if (req.maxTokens !== undefined) {
      params.max_tokens = req.maxTokens;
    }
    if (req.temperature !== undefined) {
      params.temperature = req.temperature;
    }

    const response = await this.client.chat.completions.create(params);

    const choice = response.choices[0];
    const text = choice?.message.content ?? '';
    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;

    return {
      text,
      provider: 'openai',
      model,
      tier: req.tier,
      promptTokens,
      completionTokens,
      costUsd: calcTextCost(model, promptTokens, completionTokens),
      cacheHit: false,
    };
  }
}

export class OpenAIVoiceProvider implements VoiceProvider {
  private readonly client: OpenAI;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.client = new OpenAI({
      apiKey: opts.apiKey ?? process.env['OPENAI_API_KEY'],
      maxRetries: opts.maxRetries ?? 3,
    });
  }

  async speak(req: VoiceRequest): Promise<VoiceResult> {
    const voice = OPENAI_TTS_VOICES.has(req.voiceId)
      ? (req.voiceId as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer')
      : 'alloy';

    const response = await this.client.audio.speech.create({
      model: 'tts-1',
      voice,
      input: req.text,
    });

    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);
    const costUsd = (req.text.length / 1000) * 0.015;
    // Rough estimate matching ElevenLabsVoiceProvider so downstream metrics
    // (audioSeconds, budget cost normalisation) are usable across providers.
    // ~15 chars/sec is typical English TTS pacing.
    const durationSeconds = req.text.length / 15;

    return {
      audio,
      durationSeconds,
      costUsd,
      cacheHit: false,
    };
  }
}
