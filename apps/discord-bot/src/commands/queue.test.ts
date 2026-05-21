import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queueCommand, queueHandler } from './queue.js';

// ---------------------------------------------------------------------------
// Command builder tests
// ---------------------------------------------------------------------------

describe('queue slash command', () => {
  it('has name "queue"', () => {
    expect(queueCommand.name).toBe('queue');
  });

  it('has a non-empty description', () => {
    expect(queueCommand.description.length).toBeGreaterThan(0);
  });

  it('serialises to valid JSON payload', () => {
    const json = queueCommand.toJSON();
    expect(json.name).toBe('queue');
    expect(typeof json.description).toBe('string');
  });

  it('declares "position" and "clear" subcommands', () => {
    const json = queueCommand.toJSON();
    const names = (json.options ?? []).map((o) => o.name);
    expect(names).toContain('position');
    expect(names).toContain('clear');
  });
});

// ---------------------------------------------------------------------------
// Handler helpers
// ---------------------------------------------------------------------------

/** Build a minimal interaction mock using the GuildMember (cached) roles shape. */
function makeInteraction(subcommand: string, hasModRole: boolean): ChatInputCommandInteraction {
  const roles = hasModRole
    ? { cache: { some: (fn: (r: { name: string }) => boolean) => fn({ name: 'Moderator' }) } }
    : { cache: { some: () => false } };

  return {
    options: { getSubcommand: () => subcommand },
    member: { roles },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

/** Build an interaction mock using the APIInteractionGuildMember (uncached) roles shape. */
function makeInteractionWithRoleIds(
  subcommand: string,
  memberRoleIds: string[],
): ChatInputCommandInteraction {
  return {
    options: { getSubcommand: () => subcommand },
    member: { roles: memberRoleIds },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

// ---------------------------------------------------------------------------
// /queue position
// ---------------------------------------------------------------------------

describe('queueHandler — position subcommand', () => {
  it('replies ephemerally with a position placeholder', async () => {
    const interaction = makeInteraction('position', false);

    await queueHandler(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const call = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      content: string;
      flags: number;
    };
    expect(call.flags).toBe(MessageFlags.Ephemeral);
    expect(call.content).toMatch(/^Queue position: #\d+ — queue system coming soon$/);
    const num = parseInt(call.content.match(/#(\d+)/)![1]!, 10);
    expect(num).toBeGreaterThanOrEqual(1);
    expect(num).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// /queue clear
// ---------------------------------------------------------------------------

describe('queueHandler — clear subcommand', () => {
  it('clears queue when caller has mod role', async () => {
    const interaction = makeInteraction('clear', true);

    await queueHandler(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith({ content: 'Queue cleared.' });
  });

  it('replies ephemerally with permission error when caller lacks mod role', async () => {
    const interaction = makeInteraction('clear', false);

    await queueHandler(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "You don't have permission.",
      flags: MessageFlags.Ephemeral,
    });
  });
});

// ---------------------------------------------------------------------------
// Role-ID authorization (APIInteractionGuildMember uncached path)
// ---------------------------------------------------------------------------

describe('queueHandler — clear, role-ID authorization (uncached member)', () => {
  const MOD_ROLE_ID = 'role-id-queue-mod-42';

  beforeEach(() => {
    process.env['DISCORD_MOD_ROLE_IDS'] = MOD_ROLE_ID;
  });
  afterEach(() => {
    delete process.env['DISCORD_MOD_ROLE_IDS'];
  });

  it('clears queue when member.roles string[] contains a configured mod role ID', async () => {
    const interaction = makeInteractionWithRoleIds('clear', [MOD_ROLE_ID]);

    await queueHandler(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({ content: 'Queue cleared.' });
  });

  it('denies when member.roles string[] does not contain any configured mod role ID', async () => {
    const interaction = makeInteractionWithRoleIds('clear', ['other-id']);

    await queueHandler(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "You don't have permission.",
      flags: MessageFlags.Ephemeral,
    });
  });
});
