import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { modCommand, modHandler } from './mod.js';

// ---------------------------------------------------------------------------
// Command builder tests
// ---------------------------------------------------------------------------

describe('mod slash command', () => {
  it('has name "mod"', () => {
    expect(modCommand.name).toBe('mod');
  });

  it('has a non-empty description', () => {
    expect(modCommand.description.length).toBeGreaterThan(0);
  });

  it('serialises to valid JSON payload', () => {
    const json = modCommand.toJSON();
    expect(json.name).toBe('mod');
    expect(typeof json.description).toBe('string');
  });

  it('declares "kick" and "ban" subcommands', () => {
    const json = modCommand.toJSON();
    const names = (json.options ?? []).map((o) => o.name);
    expect(names).toContain('kick');
    expect(names).toContain('ban');
  });
});

// ---------------------------------------------------------------------------
// Handler helpers
// ---------------------------------------------------------------------------

/** Build a minimal interaction mock using the GuildMember (cached) roles shape. */
function makeInteraction(
  subcommand: string,
  hasModRole: boolean,
  target = 'PlayerName',
  reason = 'Test reason',
): ChatInputCommandInteraction {
  const roles = hasModRole
    ? { cache: { some: (fn: (r: { name: string }) => boolean) => fn({ name: 'Moderator' }) } }
    : { cache: { some: () => false } };

  const sendMock = vi.fn().mockResolvedValue(undefined);
  const channelFetchMock = vi.fn().mockResolvedValue({
    isTextBased: () => true,
    isDMBased: () => false,
    send: sendMock,
  });

  return {
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string) => (name === 'target' ? target : reason),
    },
    member: { roles },
    user: { tag: 'TestMod#0001' },
    client: { channels: { fetch: channelFetchMock } },
    reply: vi.fn().mockResolvedValue(undefined),
    _sendMock: sendMock,
    _channelFetchMock: channelFetchMock,
  } as unknown as ChatInputCommandInteraction;
}

/** Build an interaction mock using the APIInteractionGuildMember (uncached) roles shape. */
function makeInteractionWithRoleIds(
  subcommand: string,
  memberRoleIds: string[],
  target = 'PlayerName',
  reason = 'Test reason',
): ChatInputCommandInteraction {
  const sendMock = vi.fn().mockResolvedValue(undefined);
  const channelFetchMock = vi.fn().mockResolvedValue({
    isTextBased: () => true,
    isDMBased: () => false,
    send: sendMock,
  });

  return {
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string) => (name === 'target' ? target : reason),
    },
    member: { roles: memberRoleIds },
    user: { tag: 'TestMod#0001' },
    client: { channels: { fetch: channelFetchMock } },
    reply: vi.fn().mockResolvedValue(undefined),
    _sendMock: sendMock,
    _channelFetchMock: channelFetchMock,
  } as unknown as ChatInputCommandInteraction;
}

// ---------------------------------------------------------------------------
// Permission guard
// ---------------------------------------------------------------------------

describe('modHandler — permission guard', () => {
  it('replies ephemerally with "Permission denied." when caller lacks mod role', async () => {
    const interaction = makeInteraction('kick', false);

    await modHandler(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Permission denied.',
      flags: MessageFlags.Ephemeral,
    });
  });
});

// ---------------------------------------------------------------------------
// /mod kick
// ---------------------------------------------------------------------------

describe('modHandler — kick subcommand', () => {
  beforeEach(() => {
    process.env['DISCORD_MOD_LOG_CHANNEL_ID'] = 'log-channel-123';
  });
  afterEach(() => {
    delete process.env['DISCORD_MOD_LOG_CHANNEL_ID'];
  });

  it('posts to the mod-log channel and replies ephemerally with "Kick logged."', async () => {
    const interaction = makeInteraction('kick', true, 'BadPlayer', 'RDM');
    const { _sendMock, _channelFetchMock } = interaction as unknown as {
      _sendMock: ReturnType<typeof vi.fn>;
      _channelFetchMock: ReturnType<typeof vi.fn>;
    };

    await modHandler(interaction);

    expect(_channelFetchMock).toHaveBeenCalledWith('log-channel-123');
    expect(_sendMock).toHaveBeenCalledTimes(1);
    const logPayload = _sendMock.mock.calls[0]![0] as { content: string };
    expect(logPayload.content).toContain('KICK');
    expect(logPayload.content).toContain('BadPlayer');
    expect(logPayload.content).toContain('RDM');

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Kick logged.',
      flags: MessageFlags.Ephemeral,
    });
  });
});

// ---------------------------------------------------------------------------
// /mod ban
// ---------------------------------------------------------------------------

describe('modHandler — ban subcommand', () => {
  beforeEach(() => {
    process.env['DISCORD_MOD_LOG_CHANNEL_ID'] = 'log-channel-456';
  });
  afterEach(() => {
    delete process.env['DISCORD_MOD_LOG_CHANNEL_ID'];
  });

  it('posts to the mod-log channel and replies ephemerally with "Ban logged."', async () => {
    const interaction = makeInteraction('ban', true, 'GrieferPlayer', 'Cheating');
    const { _sendMock, _channelFetchMock } = interaction as unknown as {
      _sendMock: ReturnType<typeof vi.fn>;
      _channelFetchMock: ReturnType<typeof vi.fn>;
    };

    await modHandler(interaction);

    expect(_channelFetchMock).toHaveBeenCalledWith('log-channel-456');
    expect(_sendMock).toHaveBeenCalledTimes(1);
    const logPayload = _sendMock.mock.calls[0]![0] as { content: string };
    expect(logPayload.content).toContain('BAN');
    expect(logPayload.content).toContain('GrieferPlayer');
    expect(logPayload.content).toContain('Cheating');

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Ban logged.',
      flags: MessageFlags.Ephemeral,
    });
  });
});

// ---------------------------------------------------------------------------
// Role-ID authorization (APIInteractionGuildMember uncached path)
// ---------------------------------------------------------------------------

describe('modHandler — role-ID authorization (uncached member)', () => {
  const MOD_ROLE_ID = 'role-id-mod-999';

  beforeEach(() => {
    process.env['DISCORD_MOD_LOG_CHANNEL_ID'] = 'log-channel-roleids';
    process.env['DISCORD_MOD_ROLE_IDS'] = MOD_ROLE_ID;
  });
  afterEach(() => {
    delete process.env['DISCORD_MOD_LOG_CHANNEL_ID'];
    delete process.env['DISCORD_MOD_ROLE_IDS'];
  });

  it('authorizes kick when member.roles string[] contains a configured mod role ID', async () => {
    const interaction = makeInteractionWithRoleIds('kick', [MOD_ROLE_ID], 'Target', 'reason');
    const { _sendMock } = interaction as unknown as { _sendMock: ReturnType<typeof vi.fn> };

    await modHandler(interaction);

    expect(_sendMock).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Kick logged.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('authorizes ban when member.roles string[] contains a configured mod role ID', async () => {
    const interaction = makeInteractionWithRoleIds('ban', [MOD_ROLE_ID], 'Target', 'reason');
    const { _sendMock } = interaction as unknown as { _sendMock: ReturnType<typeof vi.fn> };

    await modHandler(interaction);

    expect(_sendMock).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Ban logged.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('denies when member.roles string[] does not contain any configured mod role ID', async () => {
    const interaction = makeInteractionWithRoleIds('kick', ['other-role-id']);

    await modHandler(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Permission denied.',
      flags: MessageFlags.Ephemeral,
    });
  });
});
