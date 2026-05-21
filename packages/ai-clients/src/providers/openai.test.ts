import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenerationRequest, VoiceRequest } from '../index.js';

// Mock openai before importing the providers
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const mockSpeechCreate = vi.fn();

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
    audio: {
      speech: {
        create: mockSpeechCreate,
      },
    },
  }));

  return { default: MockOpenAI, __mockCreate: mockCreate, __mockSpeechCreate: mockSpeechCreate };
});

const openaiMod = await import('openai');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mod = openaiMod as any;
const mockChatCreate = mod.__mockCreate as ReturnType<typeof vi.fn>;
const mockSpeechCreate = mod.__mockSpeechCreate as ReturnType<typeof vi.fn>;

const { OpenAITextProvider, OpenAIVoiceProvider } = await import('./openai.js');

const baseTextReq: GenerationRequest = {
  purpose: 'npc-dialogue',
  tier: 1,
  system: 'You are a character.',
  user: 'Say something.',
};

const baseVoiceReq: VoiceRequest = {
  voiceId: 'nova',
  text: 'Howzit broe',
  purpose: 'npc-voice',
};

describe('OpenAITextProvider', () => {
  beforeEach(() => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'Yebo!' } }],
      usage: { prompt_tokens: 20, completion_tokens: 10 },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct GenerationResult shape', async () => {
    const provider = new OpenAITextProvider({ apiKey: 'test-key' });
    const result = await provider.generate(baseTextReq);

    expect(result.text).toBe('Yebo!');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.tier).toBe(1);
    expect(result.promptTokens).toBe(20);
    expect(result.completionTokens).toBe(10);
    expect(result.cacheHit).toBe(false);
    expect(typeof result.costUsd).toBe('number');
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('uses gpt-4o for tier >= 2', async () => {
    const provider = new OpenAITextProvider({ apiKey: 'test-key' });
    const result = await provider.generate({ ...baseTextReq, tier: 2 });
    expect(result.model).toBe('gpt-4o');
  });

  it('does NOT call console.log when logPrompts=false (default)', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const provider = new OpenAITextProvider({ apiKey: 'test-key', logPrompts: false });
    await provider.generate(baseTextReq);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('DOES call console.log with purpose (not raw prompt) when logPrompts=true', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const provider = new OpenAITextProvider({ apiKey: 'test-key', logPrompts: true });
    await provider.generate(baseTextReq);

    expect(consoleSpy).toHaveBeenCalled();
    const logArgs = consoleSpy.mock.calls.flat().join(' ');
    expect(logArgs).toContain('npc-dialogue');
    // Raw prompt text must NOT appear in logs
    expect(logArgs).not.toContain('You are a character.');
    expect(logArgs).not.toContain('Say something.');
    consoleSpy.mockRestore();
  });
});

describe('OpenAIVoiceProvider', () => {
  beforeEach(() => {
    const fakeArrayBuffer = new ArrayBuffer(8);
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () => fakeArrayBuffer,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct VoiceResult shape', async () => {
    const provider = new OpenAIVoiceProvider({ apiKey: 'test-key' });
    const result = await provider.speak(baseVoiceReq);

    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.cacheHit).toBe(false);
    expect(typeof result.costUsd).toBe('number');
    expect(result.costUsd).toBeGreaterThan(0);
    expect(typeof result.durationSeconds).toBe('number');
  });

  it('defaults to alloy voice for unknown voiceId', async () => {
    const provider = new OpenAIVoiceProvider({ apiKey: 'test-key' });
    await provider.speak({ ...baseVoiceReq, voiceId: 'unknown-voice' });

    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({ voice: 'alloy' }),
    );
  });
});
