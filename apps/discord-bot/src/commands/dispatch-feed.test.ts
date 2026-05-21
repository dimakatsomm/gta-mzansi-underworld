import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'discord.js';
import type * as DispatchFeedModule from '../dispatch-feed.js';

// Minimal stubs so the module can be imported without NATS/Discord
vi.mock('@gtarp/event-bus', () => ({
  connect: vi.fn().mockResolvedValue({
    subscribe: vi.fn().mockResolvedValue({ close: vi.fn() }),
    close: vi.fn(),
  }),
}));

describe('dispatch-feed severity helpers', () => {
  let mod: typeof DispatchFeedModule;

  beforeEach(async () => {
    mod = await import('../dispatch-feed.js');
  });

  it('exports startDispatchFeed function', () => {
    expect(typeof mod.startDispatchFeed).toBe('function');
  });

  it('startDispatchFeed returns a close function', async () => {
    const mockClient = {
      channels: { cache: { get: vi.fn().mockReturnValue(null) } },
    } as unknown as Client;

    const close = await mod.startDispatchFeed(mockClient, 'test-channel-id');
    expect(typeof close).toBe('function');
  });
});
