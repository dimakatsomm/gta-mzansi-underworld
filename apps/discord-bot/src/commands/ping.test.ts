import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { pingCommand, pingHandler } from './ping.js';

describe('ping slash command', () => {
  it('has name "ping"', () => {
    expect(pingCommand.name).toBe('ping');
  });

  it('has a non-empty description', () => {
    expect(pingCommand.description.length).toBeGreaterThan(0);
  });

  it('serialises to valid JSON payload', () => {
    const json = pingCommand.toJSON();
    expect(json.name).toBe('ping');
    expect(typeof json.description).toBe('string');
  });
});

describe('pingHandler', () => {
  it('replies with ephemeral Pong payload', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = { reply } as unknown as ChatInputCommandInteraction;

    await pingHandler(interaction);

    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith({
      content: 'Pong! 🏓',
      flags: MessageFlags.Ephemeral,
    });
  });
});
