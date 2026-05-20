import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { pingHandler } from './commands/ping.js';

const token = process.env['DISCORD_BOT_TOKEN'];

if (!token) {
  // No token — expected in CI. Exit cleanly so the pipeline stays green.
  console.log('[discord-bot] DISCORD_BOT_TOKEN not set — exiting cleanly (CI mode)');
  process.exit(0);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', (c) => {
  console.log(`[discord-bot] Ready as ${c.user.tag}`);
});

client.on('interactionCreate', (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'ping') {
    pingHandler(interaction).catch((err: unknown) => {
      console.error('[discord-bot] ping handler error:', err);
    });
  }
});

await client.login(token);
