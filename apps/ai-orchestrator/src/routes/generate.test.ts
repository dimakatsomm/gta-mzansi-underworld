import { describe, it, expect } from 'vitest';
import { TextRequestSchema, VoiceRequestSchema } from './generate.js';

// Contract tests — verify Zod schemas accept/reject correct shapes.
// These run without starting the HTTP server.

describe('TextRequestSchema', () => {
  it('accepts a valid tier-1 text request', () => {
    const result = TextRequestSchema.safeParse({
      purpose: 'dispatch',
      tier: 1,
      system: 'You are an eGoli emergency dispatcher.',
      user: 'Describe the hijacking at Hillbrow rank.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid tier values (0–3)', () => {
    for (const tier of [0, 1, 2, 3] as const) {
      expect(
        TextRequestSchema.safeParse({
          purpose: 'test',
          tier,
          system: 's',
          user: 'u',
        }).success,
      ).toBe(true);
    }
  });

  it('rejects invalid tier (e.g. 4)', () => {
    const result = TextRequestSchema.safeParse({
      purpose: 'dispatch',
      tier: 4,
      system: 's',
      user: 'u',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty user prompt', () => {
    const result = TextRequestSchema.safeParse({
      purpose: 'dispatch',
      tier: 0,
      system: 's',
      user: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing purpose', () => {
    const result = TextRequestSchema.safeParse({
      tier: 1,
      system: 's',
      user: 'u',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = TextRequestSchema.safeParse({
      purpose: 'witness',
      tier: 2,
      system: 's',
      user: 'u',
      maxTokens: 512,
      temperature: 0.7,
      cacheKey: 'witness:abc123',
    });
    expect(result.success).toBe(true);
  });
});

describe('VoiceRequestSchema', () => {
  it('accepts a valid voice request', () => {
    const result = VoiceRequestSchema.safeParse({
      voiceId: 'voice-za-male-1',
      text: 'Eish, what a day bra.',
      purpose: 'dispatch',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty text', () => {
    const result = VoiceRequestSchema.safeParse({
      voiceId: 'voice-za-male-1',
      text: '',
      purpose: 'dispatch',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty voiceId', () => {
    const result = VoiceRequestSchema.safeParse({
      voiceId: '',
      text: 'Sharp.',
      purpose: 'dispatch',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional cacheKey', () => {
    const result = VoiceRequestSchema.safeParse({
      voiceId: 'voice-za-female-1',
      text: 'Lekker day.',
      purpose: 'media',
      cacheKey: 'voice:abc123',
    });
    expect(result.success).toBe(true);
  });
});
