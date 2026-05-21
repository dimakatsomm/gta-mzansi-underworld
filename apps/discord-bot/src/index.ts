import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { pingHandler } from './commands/ping.js';
import { startDispatchFeed } from './dispatch-feed.js';

const token = process.env['DISCORD_BOT_TOKEN'];

if (!token) {
  // No token — expected in CI. Exit cleanly so the pipeline stays green.
  console.log('[discord-bot] DISCORD_BOT_TOKEN not set — exiting cleanly (CI mode)');
  process.exit(0);
}

const DISPATCH_CHANNEL_ID = process.env['DISCORD_DISPATCH_CHANNEL_ID'] ?? '';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let closeFeed: (() => void) | undefined;

client.once('ready', (c) => {
  console.log(`[discord-bot] Ready as ${c.user.tag}`);

  if (!DISPATCH_CHANNEL_ID) {
    console.warn('[discord-bot] DISCORD_DISPATCH_CHANNEL_ID not set — dispatch feed disabled');
    return;
  }

  startDispatchFeed(c, DISPATCH_CHANNEL_ID)
    .then((close) => {
      closeFeed = close;
      console.log(`[discord-bot] Dispatch feed active on channel ${DISPATCH_CHANNEL_ID}`);
    })
    .catch((err: unknown) => {
      console.error('[discord-bot] Failed to start dispatch feed:', err);
    });
});

client.on('interactionCreate', (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'ping') {
    pingHandler(interaction).catch((err: unknown) => {
      console.error('[discord-bot] ping handler error:', err);
    });
  }
});

const shutdown = () => {
  closeFeed?.();
  void client.destroy();
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

await client.login(token);
