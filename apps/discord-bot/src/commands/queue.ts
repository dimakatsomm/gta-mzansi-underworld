import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

/** Returns true when the caller has a Moderator or Admin role.
 *
 * Handles two member shapes discord.js may give us:
 * - GuildMember (cached): roles is a Collection — match by role name.
 * - APIInteractionGuildMember (not cached): roles is string[] of IDs —
 *   match against DISCORD_MOD_ROLE_IDS env var (comma-separated role IDs).
 */
function isMod(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member;
  if (!member || !('roles' in member)) return false;
  const roles = member.roles;
  if (Array.isArray(roles)) {
    const modRoleIds = (process.env['DISCORD_MOD_ROLE_IDS'] ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return modRoleIds.length > 0 && roles.some((id) => modRoleIds.includes(id));
  }
  if (typeof roles === 'string') return false;
  return roles.cache.some((r) => r.name === 'Moderator' || r.name === 'Admin');
}

export const queueCommand = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Queue management commands.')
  .addSubcommand((sub) =>
    sub.setName('position').setDescription('Check your current position in the queue.'),
  )
  .addSubcommand((sub) =>
    sub.setName('clear').setDescription('(Mod only) Clear the entire queue.'),
  );

export async function queueHandler(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'position') {
    const position = Math.floor(Math.random() * 20) + 1;
    await interaction.reply({
      content: `Queue position: #${position} — queue system coming soon`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'clear') {
    if (!isMod(interaction)) {
      await interaction.reply({
        content: "You don't have permission.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({ content: 'Queue cleared.' });
  }
}
