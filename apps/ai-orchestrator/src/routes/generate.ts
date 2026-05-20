import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

/**
 * Request schema for POST /generate/text.
 *
 * Mirrors @gtarp/ai-clients GenerationRequest so the orchestrator
 * can validate before delegating (M2+). Tier 0 = template, 3 = Opus-class.
 */
export const TextRequestSchema = z.object({
  purpose: z.string().min(1, 'purpose required'),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  system: z.string(),
  user: z.string().min(1, 'user prompt required'),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  cacheKey: z.string().optional(),
});

/**
 * Request schema for POST /generate/voice.
 *
 * Mirrors @gtarp/ai-clients VoiceRequest.
 */
export const VoiceRequestSchema = z.object({
  voiceId: z.string().min(1, 'voiceId required'),
  text: z.string().min(1, 'text required'),
  purpose: z.string().min(1, 'purpose required'),
  cacheKey: z.string().optional(),
});

export type TextRequest = z.infer<typeof TextRequestSchema>;
export type VoiceRequest = z.infer<typeof VoiceRequestSchema>;

export async function generateRoutes(app: FastifyInstance): Promise<void> {
  app.post('/generate/text', async (req, reply) => {
    const result = TextRequestSchema.safeParse(req.body);
    if (!result.success) {
      return reply.code(400).send({ error: 'Bad Request', details: result.error.issues });
    }
    return reply.code(501).send({ error: 'Not Implemented' });
  });

  app.post('/generate/voice', async (req, reply) => {
    const result = VoiceRequestSchema.safeParse(req.body);
    if (!result.success) {
      return reply.code(400).send({ error: 'Bad Request', details: result.error.issues });
    }
    return reply.code(501).send({ error: 'Not Implemented' });
  });
}
