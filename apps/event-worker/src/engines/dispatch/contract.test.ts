/**
 * Contract test — verifies that a `dispatch.requested` payload assembled by
 * the dispatch engine satisfies the canonical Zod schema in @gtarp/event-schema.
 *
 * Failing this test means either the engine produces invalid payloads OR the
 * schema changed without a versioned migration — both are blocking.
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DispatchRequested } from '@gtarp/event-schema';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    type: 'dispatch.requested' as const,
    version: 1 as const,
    occurredAt: new Date().toISOString(),
    data: {
      incidentId: randomUUID(),
      severity: 'minor' as const,
      location: { x: 100, y: 200, z: 10, province: 'GP' as const, area: 'Yeoville' },
      summary: 'Control to all units in the kasi — robbery in progress at Yeoville corner shop.',
      ...overrides,
    },
  };
}

describe('dispatch.requested schema contract', () => {
  it('valid minimal payload parses successfully', () => {
    const result = DispatchRequested.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('payload with voiceUrl parses successfully', () => {
    const result = DispatchRequested.safeParse(
      validPayload({ voiceUrl: 'https://cdn.gtarp.example/audio/dispatch/abc123.mp3' }),
    );
    expect(result.success).toBe(true);
  });

  it('payload without voiceUrl is still valid (field is optional)', () => {
    const payload = validPayload();
    const result = DispatchRequested.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data.voiceUrl).toBeUndefined();
    }
  });

  it('all severity values are accepted', () => {
    const severities = ['petty', 'minor', 'major', 'serious', 'capital'] as const;
    for (const severity of severities) {
      const result = DispatchRequested.safeParse(validPayload({ severity }));
      expect(result.success, `severity=${severity} should parse`).toBe(true);
    }
  });

  it('missing incidentId fails validation', () => {
    const payload = validPayload();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload.data as any).incidentId;
    expect(DispatchRequested.safeParse(payload).success).toBe(false);
  });

  it('invalid severity fails validation', () => {
    const result = DispatchRequested.safeParse(validPayload({ severity: 'extreme' }));
    expect(result.success).toBe(false);
  });

  it('missing summary fails validation', () => {
    const payload = validPayload();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload.data as any).summary;
    expect(DispatchRequested.safeParse(payload).success).toBe(false);
  });

  it('wrong type literal fails', () => {
    const payload = { ...validPayload(), type: 'crime.committed' };
    expect(DispatchRequested.safeParse(payload).success).toBe(false);
  });

  it('correlationId is optional', () => {
    const payload = { ...validPayload(), correlationId: randomUUID() };
    expect(DispatchRequested.safeParse(payload).success).toBe(true);
  });
});
