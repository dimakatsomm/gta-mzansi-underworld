import { EmbedBuilder, type TextChannel, type Client } from 'discord.js';
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

  const sub = await bus.subscribe(
    'gtarp.dispatch.requested',
    async (evt) => {
      if (evt.type !== 'dispatch.requested') return;
      const dispatch = evt as DispatchRequested;

      const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
      if (!channel) {
        console.warn(`[discord-feed] channel ${channelId} not in cache — skipping`);
        return;
      }

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
    { durableName: 'discord-feed', deliverPolicy: 'new' },
  );

  return () => {
    sub.close();
    void bus.close();
  };
}
