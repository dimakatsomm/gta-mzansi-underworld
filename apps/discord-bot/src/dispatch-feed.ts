import { hostname } from 'node:os';
import { EmbedBuilder, ChannelType, type TextChannel, type Client } from 'discord.js';
import { connect as connectBus } from '@gtarp/event-bus';
import type { DispatchRequested } from '@gtarp/event-schema';

/** Severity → Discord embed accent colour (decimal). */
const SEVERITY_COLOUR: Record<string, number> = {
  petty: 0x6b7280, // grey
  minor: 0xf59e0b, // amber
  major: 0xef4444, // red
  serious: 0x7c3aed, // purple
  capital: 0xdc2626, // deep red
};

/** Severity → SA-flavoured emoji prefix. */
const SEVERITY_EMOJI: Record<string, string> = {
  petty: '🔵',
  minor: '🟡',
  major: '🔴',
  serious: '🟣',
  capital: '💀',
};

/**
 * Starts a NATS subscription for `dispatch.requested` events and posts
 * formatted incident embeds to the configured Discord channel.
 *
 * Returns a close function for graceful shutdown.
 */
export async function startDispatchFeed(client: Client, channelId: string): Promise<() => void> {
  const natsUrl = process.env['NATS_URL'] ?? 'nats://localhost:4222';
  const bus = await connectBus({ servers: natsUrl });

  // Resolve the channel once via fetch (cache may be cold/partial after a
  // reconnect or restart). Fail fast at startup rather than silently skipping
  // every incident.
  const resolved = await client.channels.fetch(channelId);
  if (!resolved || !('send' in resolved) || resolved.type !== ChannelType.GuildText) {
    throw new Error(
      `[discord-feed] channel ${channelId} is not a sendable GuildText channel (got ${resolved?.type ?? 'null'})`,
    );
  }
  const channel = resolved as TextChannel;

  // Each replica must post the full incident stream, so each gets its own
  // JetStream durable consumer (hostname + pid + random suffix). A shared
  // durable name would load-balance messages and only one bot would post.
  const durableSuffix = `${sanitiseDurable(hostname())}-${process.pid}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const sub = await bus.subscribe(
    'gtarp.dispatch.requested',
    async (evt) => {
      if (evt.type !== 'dispatch.requested') return;
      const dispatch = evt as DispatchRequested;

      const { severity, location, summary, incidentId } = dispatch.data;
      const colour = SEVERITY_COLOUR[severity] ?? 0xf59e0b;
      const emoji = SEVERITY_EMOJI[severity] ?? '🔵';
      const area = location.area.replace(/_/g, ' ').toUpperCase();

      const embed = new EmbedBuilder()
        .setColor(colour)
        .setTitle(`${emoji} ${severity.toUpperCase()} INCIDENT — ${area}`)
        .setDescription(summary)
        .addFields(
          { name: 'Province', value: location.province, inline: true },
          { name: 'Severity', value: severity, inline: true },
          { name: 'Incident ID', value: `\`${incidentId.slice(0, 8)}\``, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Mzansi Underworld RP — Police Dispatch' });

      await channel.send({ embeds: [embed] });
      console.log(`[discord-feed] posted incident ${incidentId} to channel ${channelId}`);
    },
    { durableName: `discord-feed-${durableSuffix}`, deliverPolicy: 'new' },
  );

  return () => {
    sub.close();
    void bus.close();
  };
}

/** JetStream durable names allow only [A-Za-z0-9_-]. */
function sanitiseDurable(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
}
