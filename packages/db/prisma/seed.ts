/**
 * SA-flavoured seed — territories, gangs, families, businesses, players.
 * Names and place constants are sourced from @gtarp/sa-content (canon).
 * All rows keyed on stable UUIDs / unique fields for idempotent upserts.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — required by @prisma/adapter-pg for seeding.');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ['warn', 'error'],
});

// ── Stable IDs ──────────────────────────────────────────────────────────────
// Hardcoded so upserts are truly idempotent across repeated seed runs.

const GANG_IDS = {
  topSix: '11110001-0001-0001-0001-000000000001',
  ironHand: '11110001-0001-0001-0001-000000000002',
  khanyisa: '11110001-0001-0001-0001-000000000003',
  amabombers: '11110001-0001-0001-0001-000000000004',
};

const PLAYER_IDS = {
  sipho: '22220002-0002-0002-0002-000000000001',
  nomvula: '22220002-0002-0002-0002-000000000002',
  thabo: '22220002-0002-0002-0002-000000000003',
  bongani: '22220002-0002-0002-0002-000000000004',
  lerato: '22220002-0002-0002-0002-000000000005',
  andile: '22220002-0002-0002-0002-000000000006',
  vusi: '22220002-0002-0002-0002-000000000007',
  naledi: '22220002-0002-0002-0002-000000000008',
};

const FAMILY_IDS = {
  mokoena: '55550005-0005-0005-0005-000000000001',
  dlamini: '55550005-0005-0005-0005-000000000002',
  cele: '55550005-0005-0005-0005-000000000003',
};

// ── Gangs (≥4) ───────────────────────────────────────────────────────────────
// Lore-bible §4: Top Six, Iron Hand, Khanyisa are canon.  Amabombers = independent crew.

const GANGS = [
  {
    id: GANG_IDS.topSix,
    name: 'Top Six',
    colors: 'yellow/black',
    reputation: 72,
  },
  {
    id: GANG_IDS.ironHand,
    name: 'Iron Hand',
    colors: 'grey/red',
    reputation: 65,
  },
  {
    id: GANG_IDS.khanyisa,
    name: 'Khanyisa',
    colors: 'green/gold',
    reputation: 58,
  },
  {
    id: GANG_IDS.amabombers,
    name: 'Amabombers',
    colors: 'black/white',
    reputation: 41,
  },
];

// ── Players (8) ──────────────────────────────────────────────────────────────
// All fivemLicense values must carry the `seed_` prefix per spec.
// SA ID format: YYMMDD SSSS 0 8 Z  (13 digits; Luhn-valid).

const PLAYERS = [
  {
    id: PLAYER_IDS.sipho,
    fivemLicense: 'seed_sipho_mokoena',
    displayName: 'Sipho Mokoena',
    identity: {
      id: '77770007-0007-0007-0007-000000000001',
      firstName: 'Sipho',
      lastName: 'Mokoena',
      idNumber: '9005155001084', // born 1990-05-15, male
      birthDate: new Date('1990-05-15'),
      province: 'GP',
      isPrimary: true,
    },
  },
  {
    id: PLAYER_IDS.nomvula,
    fivemLicense: 'seed_nomvula_dlamini',
    displayName: 'Nomvula Dlamini',
    identity: {
      id: '77770007-0007-0007-0007-000000000002',
      firstName: 'Nomvula',
      lastName: 'Dlamini',
      idNumber: '9208232000083', // born 1992-08-23, female
      birthDate: new Date('1992-08-23'),
      province: 'WC',
      isPrimary: true,
    },
  },
  {
    id: PLAYER_IDS.thabo,
    fivemLicense: 'seed_thabo_khumalo',
    displayName: 'Thabo Khumalo',
    identity: {
      id: '77770007-0007-0007-0007-000000000003',
      firstName: 'Thabo',
      lastName: 'Khumalo',
      idNumber: '8803076001089', // born 1988-03-07, male
      birthDate: new Date('1988-03-07'),
      province: 'KZN',
      isPrimary: true,
    },
  },
  {
    id: PLAYER_IDS.bongani,
    fivemLicense: 'seed_bongani_ndlovu',
    displayName: 'Bongani Ndlovu',
    identity: {
      id: '77770007-0007-0007-0007-000000000004',
      firstName: 'Bongani',
      lastName: 'Ndlovu',
      idNumber: '9311297001085', // born 1993-11-29, male
      birthDate: new Date('1993-11-29'),
      province: 'GP',
      isPrimary: true,
    },
  },
  {
    id: PLAYER_IDS.lerato,
    fivemLicense: 'seed_lerato_nkosi',
    displayName: 'Lerato Nkosi',
    identity: {
      id: '77770007-0007-0007-0007-000000000005',
      firstName: 'Lerato',
      lastName: 'Nkosi',
      idNumber: '9507141000088', // born 1995-07-14, female
      birthDate: new Date('1995-07-14'),
      province: 'GP',
      isPrimary: true,
    },
  },
  {
    id: PLAYER_IDS.andile,
    fivemLicense: 'seed_andile_cele',
    displayName: 'Andile Cele',
    identity: {
      id: '77770007-0007-0007-0007-000000000006',
      firstName: 'Andile',
      lastName: 'Cele',
      idNumber: '9104225001081', // born 1991-04-22, male
      birthDate: new Date('1991-04-22'),
      province: 'KZN',
      isPrimary: true,
    },
  },
  {
    id: PLAYER_IDS.vusi,
    fivemLicense: 'seed_vusi_mahlangu',
    displayName: 'Vusi Mahlangu',
    identity: {
      id: '77770007-0007-0007-0007-000000000007',
      firstName: 'Vusi',
      lastName: 'Mahlangu',
      idNumber: '8909308001084', // born 1989-09-30, male
      birthDate: new Date('1989-09-30'),
      province: 'GP',
      isPrimary: true,
    },
  },
  {
    id: PLAYER_IDS.naledi,
    fivemLicense: 'seed_naledi_sithole',
    displayName: 'Naledi Sithole',
    identity: {
      id: '77770007-0007-0007-0007-000000000008',
      firstName: 'Naledi',
      lastName: 'Sithole',
      idNumber: '9702183000084', // born 1997-02-18, female
      birthDate: new Date('1997-02-18'),
      province: 'WC',
      isPrimary: true,
    },
  },
];

// ── Gang memberships ──────────────────────────────────────────────────────────

const GANG_MEMBERSHIPS = [
  // Top Six — Joburg taxi syndicate
  { gangId: GANG_IDS.topSix, playerId: PLAYER_IDS.sipho, rank: 'boss' },
  { gangId: GANG_IDS.topSix, playerId: PLAYER_IDS.bongani, rank: 'captain' },
  { gangId: GANG_IDS.topSix, playerId: PLAYER_IDS.vusi, rank: 'soldier' },
  // Iron Hand — ex-security/CIT crew
  { gangId: GANG_IDS.ironHand, playerId: PLAYER_IDS.lerato, rank: 'lieutenant' },
  // Khanyisa — KZN port drug network
  { gangId: GANG_IDS.khanyisa, playerId: PLAYER_IDS.thabo, rank: 'boss' },
  { gangId: GANG_IDS.khanyisa, playerId: PLAYER_IDS.andile, rank: 'soldier' },
  // Amabombers — independent Cape Town crew
  { gangId: GANG_IDS.amabombers, playerId: PLAYER_IDS.nomvula, rank: 'captain' },
  { gangId: GANG_IDS.amabombers, playerId: PLAYER_IDS.naledi, rank: 'recruit' },
];

// ── Territories (20) ─────────────────────────────────────────────────────────
// GP: 11  |  WC: 5  |  KZN: 4  = 20 total

const TERRITORIES = [
  // GP — Top Six dominates Joburg inner-city; Iron Hand holds northern burbs
  {
    id: '33330003-0003-0003-0003-000000000001',
    name: 'Hillbrow',
    province: 'GP',
    area: 'hillbrow',
    controllerId: GANG_IDS.topSix,
    control: 0.85,
  },
  {
    id: '33330003-0003-0003-0003-000000000002',
    name: 'Yeoville',
    province: 'GP',
    area: 'yeoville',
    controllerId: GANG_IDS.topSix,
    control: 0.7,
  },
  {
    id: '33330003-0003-0003-0003-000000000003',
    name: 'Alexandra',
    province: 'GP',
    area: 'alexandra',
    controllerId: GANG_IDS.topSix,
    control: 0.6,
  },
  {
    id: '33330003-0003-0003-0003-000000000004',
    name: 'Sandton',
    province: 'GP',
    area: 'sandton',
    controllerId: GANG_IDS.ironHand,
    control: 0.55,
  },
  {
    id: '33330003-0003-0003-0003-000000000005',
    name: 'Soweto - Diepkloof',
    province: 'GP',
    area: 'soweto_diepkloof',
    controllerId: GANG_IDS.topSix,
    control: 0.75,
  },
  {
    id: '33330003-0003-0003-0003-000000000006',
    name: 'Soweto - Orlando East',
    province: 'GP',
    area: 'soweto_orlando_east',
    controllerId: GANG_IDS.topSix,
    control: 0.65,
  },
  {
    id: '33330003-0003-0003-0003-000000000007',
    name: 'Braamfontein',
    province: 'GP',
    area: 'braamfontein',
    controllerId: GANG_IDS.ironHand,
    control: 0.5,
  },
  {
    id: '33330003-0003-0003-0003-000000000008',
    name: 'Joburg CBD',
    province: 'GP',
    area: 'cbd',
    controllerId: GANG_IDS.topSix,
    control: 0.8,
  },
  {
    id: '33330003-0003-0003-0003-000000000009',
    name: 'Fordsburg',
    province: 'GP',
    area: 'fordsburg',
    controllerId: null,
    control: 0.2,
  },
  {
    id: '33330003-0003-0003-0003-000000000010',
    name: 'Tembisa',
    province: 'GP',
    area: 'tembisa',
    controllerId: GANG_IDS.ironHand,
    control: 0.45,
  },
  {
    id: '33330003-0003-0003-0003-000000000011',
    name: 'Midrand',
    province: 'GP',
    area: 'midrand',
    controllerId: GANG_IDS.ironHand,
    control: 0.4,
  },
  // WC — Amabombers rule the Cape Flats
  {
    id: '33330003-0003-0003-0003-000000000012',
    name: 'Khayelitsha',
    province: 'WC',
    area: 'khayelitsha',
    controllerId: GANG_IDS.amabombers,
    control: 0.8,
  },
  {
    id: '33330003-0003-0003-0003-000000000013',
    name: 'Mitchells Plain',
    province: 'WC',
    area: 'mitchells_plain',
    controllerId: GANG_IDS.amabombers,
    control: 0.7,
  },
  {
    id: '33330003-0003-0003-0003-000000000014',
    name: 'Gugulethu',
    province: 'WC',
    area: 'gugulethu',
    controllerId: GANG_IDS.amabombers,
    control: 0.6,
  },
  {
    id: '33330003-0003-0003-0003-000000000015',
    name: 'Bo-Kaap',
    province: 'WC',
    area: 'bo_kaap',
    controllerId: null,
    control: 0.15,
  },
  {
    id: '33330003-0003-0003-0003-000000000016',
    name: 'Woodstock',
    province: 'WC',
    area: 'woodstock',
    controllerId: null,
    control: 0.25,
  },
  // KZN — Khanyisa runs the port corridor
  {
    id: '33330003-0003-0003-0003-000000000017',
    name: 'Umlazi',
    province: 'KZN',
    area: 'umlazi',
    controllerId: GANG_IDS.khanyisa,
    control: 0.75,
  },
  {
    id: '33330003-0003-0003-0003-000000000018',
    name: 'Kwa-Mashu',
    province: 'KZN',
    area: 'kwa_mashu',
    controllerId: GANG_IDS.khanyisa,
    control: 0.65,
  },
  {
    id: '33330003-0003-0003-0003-000000000019',
    name: 'Chatsworth',
    province: 'KZN',
    area: 'chatsworth',
    controllerId: GANG_IDS.khanyisa,
    control: 0.55,
  },
  {
    id: '33330003-0003-0003-0003-000000000020',
    name: 'The Point',
    province: 'KZN',
    area: 'point',
    controllerId: GANG_IDS.khanyisa,
    control: 0.9,
  },
];

// ── Families (3) ──────────────────────────────────────────────────────────────

const FAMILIES = [
  {
    id: FAMILY_IDS.mokoena,
    surname: 'Mokoena',
    motto: 'Ke nako — the time is now.',
    reputation: 55,
    members: [
      { playerId: PLAYER_IDS.sipho, role: 'patriarch' },
      { playerId: PLAYER_IDS.bongani, role: 'sibling' },
    ],
  },
  {
    id: FAMILY_IDS.dlamini,
    surname: 'Dlamini',
    motto: 'Siyaphila ngamanzi — we live by the water.',
    reputation: 42,
    members: [
      { playerId: PLAYER_IDS.nomvula, role: 'matriarch' },
      { playerId: PLAYER_IDS.lerato, role: 'sibling' },
    ],
  },
  {
    id: FAMILY_IDS.cele,
    surname: 'Cele',
    motto: 'Amandla ngawethu.',
    reputation: 38,
    members: [
      { playerId: PLAYER_IDS.andile, role: 'patriarch' },
      { playerId: PLAYER_IDS.naledi, role: 'in_law' },
    ],
  },
];

// ── Businesses (10 — one per kind) ───────────────────────────────────────────

const BUSINESSES = [
  {
    id: '44440004-0004-0004-0004-000000000001',
    name: "Bra Sipho's Shisa Nyama",
    kind: 'shisa_nyama',
    province: 'GP',
    area: 'hillbrow',
    isFront: false,
    laundering: false,
    reputation: 60,
  },
  {
    id: '44440004-0004-0004-0004-000000000002',
    name: 'Skomplaas Tavern',
    kind: 'tavern',
    province: 'GP',
    area: 'soweto_diepkloof',
    isFront: true,
    laundering: true,
    reputation: 45,
  },
  {
    id: '44440004-0004-0004-0004-000000000003',
    name: 'Top Six Taxi Association',
    kind: 'taxi_assoc',
    province: 'GP',
    area: 'cbd',
    isFront: false,
    laundering: false,
    reputation: 78,
  },
  {
    id: '44440004-0004-0004-0004-000000000004',
    name: 'Iron Eagle Security Services',
    kind: 'security',
    province: 'GP',
    area: 'sandton',
    isFront: true,
    laundering: true,
    reputation: 52,
  },
  {
    id: '44440004-0004-0004-0004-000000000005',
    name: 'Ndlovu Auto Dealership',
    kind: 'dealership',
    province: 'GP',
    area: 'midrand',
    isFront: false,
    laundering: false,
    reputation: 55,
  },
  {
    id: '44440004-0004-0004-0004-000000000006',
    name: 'Tshwane Quick Logistics',
    kind: 'logistics',
    province: 'GP',
    area: 'tembisa',
    isFront: true,
    laundering: true,
    reputation: 40,
  },
  {
    id: '44440004-0004-0004-0004-000000000007',
    name: 'Sibanye Build Solutions',
    kind: 'construction',
    province: 'GP',
    area: 'braamfontein',
    isFront: false,
    laundering: false,
    reputation: 48,
  },
  {
    id: '44440004-0004-0004-0004-000000000008',
    name: 'Amapiano Nights Club',
    kind: 'club',
    province: 'WC',
    area: 'woodstock',
    isFront: true,
    laundering: true,
    reputation: 70,
  },
  {
    id: '44440004-0004-0004-0004-000000000009',
    name: 'Durban Bay Tech Hub',
    kind: 'tech',
    province: 'KZN',
    area: 'point',
    isFront: false,
    laundering: false,
    reputation: 35,
  },
  {
    id: '44440004-0004-0004-0004-000000000010',
    name: 'Khanyisa Mining Ops',
    kind: 'mining',
    province: 'KZN',
    area: 'umlazi',
    isFront: true,
    laundering: true,
    reputation: 30,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding SA sample data…');

  // 1. Gangs
  console.log('  → gangs');
  for (const gang of GANGS) {
    // Upsert by id so dependent rows (memberships, territories) keying off
    // GANG_IDS always reference the canonical UUID. If a prior row exists with
    // the same name under a different id, the create branch would conflict on
    // the unique name constraint — that's intentional, surface the divergence.
    await prisma.gang.upsert({
      where: { id: gang.id },
      update: { name: gang.name, colors: gang.colors, reputation: gang.reputation },
      create: gang,
    });
  }

  // 2. Players + Identities
  console.log('  → players & identities');
  for (const p of PLAYERS) {
    const { identity, ...playerData } = p;
    await prisma.player.upsert({
      where: { fivemLicense: playerData.fivemLicense },
      update: { displayName: playerData.displayName },
      create: playerData,
    });
    await prisma.identity.upsert({
      where: { idNumber: identity.idNumber },
      update: { province: identity.province },
      create: { ...identity, playerId: playerData.id },
    });
  }

  // 3. Gang memberships
  console.log('  → gang memberships');
  for (const m of GANG_MEMBERSHIPS) {
    await prisma.gangMembership.upsert({
      where: { gangId_playerId: { gangId: m.gangId, playerId: m.playerId } },
      update: { rank: m.rank },
      create: m,
    });
  }

  // 4. Territories
  console.log('  → territories');
  for (const t of TERRITORIES) {
    await prisma.territory.upsert({
      where: { id: t.id },
      update: { controllerId: t.controllerId, control: t.control },
      create: t,
    });
  }

  // 5. Families + members
  console.log('  → families & members');
  for (const fam of FAMILIES) {
    const { members, ...famData } = fam;
    await prisma.family.upsert({
      where: { id: famData.id },
      update: { motto: famData.motto, reputation: famData.reputation },
      create: famData,
    });
    for (const mem of members) {
      await prisma.familyMember.upsert({
        where: {
          familyId_playerId: { familyId: famData.id, playerId: mem.playerId },
        },
        update: { role: mem.role },
        create: { familyId: famData.id, ...mem },
      });
    }
  }

  // 6. Businesses
  console.log('  → businesses');
  for (const biz of BUSINESSES) {
    await prisma.business.upsert({
      where: { id: biz.id },
      update: {
        isFront: biz.isFront,
        laundering: biz.laundering,
        reputation: biz.reputation,
      },
      create: biz,
    });
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
