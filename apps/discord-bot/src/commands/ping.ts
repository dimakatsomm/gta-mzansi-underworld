import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

/** /ping — liveness check for the bot. */
export const pingCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Pong! Check if the bot is alive.');

export async function pingHandler(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({ content: 'Pong! 🏓', flags: MessageFlags.Ephemeral });
}
