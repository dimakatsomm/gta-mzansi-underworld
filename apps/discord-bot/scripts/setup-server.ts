import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type Role,
  type CategoryChannel,
  type GuildBasedChannel,
  type OverwriteResolvable,
} from 'discord.js';

const token = process.env['DISCORD_BOT_TOKEN'];
const guildId = process.env['DISCORD_GUILD_ID'];

if (!token) {
  console.error('[setup-server] DISCORD_BOT_TOKEN not set');
  process.exit(1);
}
if (!guildId) {
  console.error('[setup-server] DISCORD_GUILD_ID not set');
  process.exit(1);
}

interface RoleSpec {
  name: string;
  color: number;
  hoist: boolean;
}

const ROLES: RoleSpec[] = [
  { name: 'Admin', color: 0xe11d48, hoist: true },
  { name: 'Moderator', color: 0xf59e0b, hoist: true },
  { name: 'Alpha Tester', color: 0x7c3aed, hoist: true },
  { name: 'Police', color: 0x2563eb, hoist: true },
  { name: 'Gang Leader', color: 0x14532d, hoist: true },
  { name: 'Business Owner', color: 0x059669, hoist: false },
  { name: 'Verified', color: 0x6b7280, hoist: false },
];

interface ChannelSpec {
  name: string;
  topic?: string;
  restricted?: 'mods';
  readonly?: boolean;
}

interface CategorySpec {
  name: string;
  channels: ChannelSpec[];
}

const CATEGORIES: CategorySpec[] = [
  {
    name: '📜 INFO',
    channels: [
      { name: 'welcome', topic: 'Read this first', readonly: true },
      { name: 'rules', topic: 'Server and RP rules', readonly: true },
      { name: 'announcements', topic: 'Server updates', readonly: true },
      { name: 'devlogs', topic: 'Behind-the-scenes development notes', readonly: true },
    ],
  },
  {
    name: '💬 COMMUNITY',
    channels: [
      { name: 'general-chat', topic: 'Out-of-character chat' },
      { name: 'suggestions', topic: 'Ideas for the server' },
      { name: 'bug-reports', topic: 'Report bugs you encounter in-game' },
      { name: 'media-clips', topic: 'Share your in-game clips and screenshots' },
    ],
  },
  {
    name: '🎮 IN-GAME',
    channels: [
      { name: 'dispatch-feed', topic: 'Live PPS dispatch alerts from in-game' },
      { name: 'incident-log', topic: 'Crime and arrest log', restricted: 'mods' },
      { name: 'mod-log', topic: 'Moderation actions audit log', restricted: 'mods' },
    ],
  },
  {
    name: '📋 APPLICATIONS',
    channels: [
      { name: 'alpha-signup', topic: 'Apply to join the closed alpha' },
      { name: 'police-recruitment', topic: 'Apply to join the PPS', readonly: true },
      { name: 'gang-recruitment', topic: 'Gang recruitment posts', readonly: true },
      { name: 'business-applications', topic: 'Apply to run a business', readonly: true },
    ],
  },
];

async function ensureRole(guild: Guild, spec: RoleSpec): Promise<Role> {
  const existing = guild.roles.cache.find((r) => r.name === spec.name);
  if (existing) {
    console.log(`[role] ${spec.name} — exists (${existing.id})`);
    return existing;
  }
  const role = await guild.roles.create({
    name: spec.name,
    color: spec.color,
    hoist: spec.hoist,
    reason: 'Mzansi Underworld RP alpha setup',
  });
  console.log(`[role] ${spec.name} — created (${role.id})`);
  return role;
}

async function ensureCategory(guild: Guild, name: string): Promise<CategoryChannel> {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === name,
  ) as CategoryChannel | undefined;
  if (existing) {
    console.log(`[category] ${name} — exists (${existing.id})`);
    return existing;
  }
  const category = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    reason: 'Mzansi Underworld RP alpha setup',
  });
  console.log(`[category] ${name} — created (${category.id})`);
  return category;
}

async function ensureChannel(
  guild: Guild,
  parent: CategoryChannel,
  spec: ChannelSpec,
  roles: Map<string, Role>,
): Promise<GuildBasedChannel> {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === spec.name && c.parentId === parent.id,
  );
  if (existing) {
    console.log(`[channel] #${spec.name} — exists (${existing.id})`);
    return existing;
  }

  const overwrites: OverwriteResolvable[] = [];
  const everyone = guild.roles.everyone;

  if (spec.restricted === 'mods') {
    overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
    const admin = roles.get('Admin');
    const mod = roles.get('Moderator');
    if (admin) {
      overwrites.push({
        id: admin.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }
    if (mod) {
      overwrites.push({
        id: mod.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }
  } else if (spec.readonly) {
    overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.SendMessages] });
    const admin = roles.get('Admin');
    const mod = roles.get('Moderator');
    if (admin) overwrites.push({ id: admin.id, allow: [PermissionFlagsBits.SendMessages] });
    if (mod) overwrites.push({ id: mod.id, allow: [PermissionFlagsBits.SendMessages] });
  }

  const channel = await guild.channels.create({
    name: spec.name,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic: spec.topic,
    permissionOverwrites: overwrites,
    reason: 'Mzansi Underworld RP alpha setup',
  });
  console.log(`[channel] #${spec.name} — created (${channel.id})`);
  return channel;
}

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  await new Promise<void>((resolve) => client.once('ready', () => resolve()));

  const guild = await client.guilds.fetch(guildId as string);
  await guild.roles.fetch();
  await guild.channels.fetch();
  console.log(`\nSetting up guild: ${guild.name} (${guild.id})\n`);

  const roleMap = new Map<string, Role>();
  for (const spec of ROLES) {
    const role = await ensureRole(guild, spec);
    roleMap.set(spec.name, role);
  }

  console.log('');
  const channelIds: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const category = await ensureCategory(guild, cat.name);
    for (const ch of cat.channels) {
      const channel = await ensureChannel(guild, category, ch, roleMap);
      channelIds[ch.name] = channel.id;
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log('Copy these into your .env.production:');
  console.log('────────────────────────────────────────');
  console.log(`DISCORD_GUILD_ID=${guild.id}`);
  if (channelIds['dispatch-feed'])
    console.log(`DISCORD_DISPATCH_CHANNEL_ID=${channelIds['dispatch-feed']}`);
  if (channelIds['incident-log'])
    console.log(`DISCORD_INCIDENT_CHANNEL_ID=${channelIds['incident-log']}`);
  if (channelIds['mod-log']) console.log(`DISCORD_MOD_LOG_CHANNEL_ID=${channelIds['mod-log']}`);
  const modIds = [roleMap.get('Admin')?.id, roleMap.get('Moderator')?.id].filter(Boolean).join(',');
  console.log(`DISCORD_MOD_ROLE_IDS=${modIds}`);
  console.log('────────────────────────────────────────\n');

  await client.destroy();
}

main().catch((err: unknown) => {
  console.error('[setup-server] fatal:', err);
  process.exit(1);
});
