/**
 * SA-content lexicon. Canon for naming, places, slang.
 * Curated — additions require lore-bible alignment and a PR review.
 */

/**
 * Canonical place / cultural reference strings used across UI copy.
 * Source: lore-bible §1 (naming) and §3 (cultural references).
 */
export const PLACES = {
  /** In-world country name. Colloquial Zulu/Xhosa for South Africa. */
  MZANSI: 'Mzansi',
  /** In-world capital. Colloquial Sesotho/Zulu for Johannesburg ("place of gold"). */
  EGOLI: 'eGoli',
} as const;

/**
 * Cultural references — music, food, slang categories — that may surface in
 * marketing/UI copy. Keep additions scoped to terms already in the lore bible.
 */
export const CULTURAL_TERMS = {
  /** SA house-music subgenre. */
  AMAPIANO: 'Amapiano',
} as const;

export const PROVINCES = {
  GP: { name: 'Gauteng', metros: ['Joburg', 'Pretoria'] },
  WC: { name: 'Western Cape', metros: ['Cape Town'] },
  KZN: { name: 'KwaZulu-Natal', metros: ['Durban'] },
  EC: { name: 'Eastern Cape', metros: ['Gqeberha', 'East London'] },
  NC: { name: 'Northern Cape', metros: ['Kimberley'] },
  FS: { name: 'Free State', metros: ['Bloemfontein'] },
  NW: { name: 'North West', metros: ['Mahikeng'] },
  MP: { name: 'Mpumalanga', metros: ['Mbombela'] },
  LP: { name: 'Limpopo', metros: ['Polokwane'] },
} as const;

export const JOBURG_AREAS = [
  'hillbrow',
  'yeoville',
  'alexandra',
  'sandton',
  'rosebank',
  'soweto_diepkloof',
  'soweto_orlando_east',
  'soweto_pimville',
  'cbd',
  'braamfontein',
  'fordsburg',
  'tembisa',
  'midrand',
] as const;

export const CAPE_TOWN_AREAS = [
  'khayelitsha',
  'mitchells_plain',
  'gugulethu',
  'sea_point',
  'bo_kaap',
  'woodstock',
  'observatory',
  'cbd',
] as const;

export const DURBAN_AREAS = [
  'umlazi',
  'chatsworth',
  'phoenix',
  'kwa_mashu',
  'point',
  'cbd',
] as const;

// Slang lexicon. Use sparingly — over-use slides into caricature.
// Each entry includes register so prompts can pick formal/informal correctly.
export const SLANG: Array<{
  term: string;
  meaning: string;
  register: 'street' | 'casual' | 'tsotsitaal';
}> = [
  { term: 'eish', meaning: 'mild dismay / sympathy', register: 'casual' },
  { term: 'sharp', meaning: 'cool / agreed', register: 'casual' },
  { term: 'lekker', meaning: 'good / nice', register: 'casual' },
  { term: 'bra', meaning: 'brother / friend', register: 'street' },
  { term: 'china', meaning: 'friend', register: 'street' },
  { term: 'zol', meaning: 'cigarette / joint', register: 'street' },
  { term: 'skebenga', meaning: 'criminal', register: 'tsotsitaal' },
  { term: 'mfowethu', meaning: 'my brother', register: 'street' },
  { term: 'jol', meaning: 'party / fun', register: 'casual' },
  { term: 'kasi', meaning: 'township', register: 'casual' },
];

// Surnames — common across SA. No single ethnic group over-represented.
export const SURNAMES = [
  'Mokoena',
  'Dlamini',
  'Khumalo',
  'Naidoo',
  'van der Merwe',
  'Pillay',
  'Botha',
  'Ndlovu',
  'Mahlangu',
  'Sithole',
  'du Plessis',
  'Mbeki',
  'Nkosi',
  'Pretorius',
  'Cele',
  'Mthembu',
  'Zulu',
  'de Klerk',
  'Moodley',
  'Tshabalala',
];

export const FIRST_NAMES = {
  m: [
    'Sipho',
    'Thabo',
    'Pieter',
    'Bongani',
    'Andile',
    'Lwazi',
    'Kagiso',
    'Vusi',
    'Rohan',
    'Mandla',
  ],
  f: [
    'Nomvula',
    'Lerato',
    'Anika',
    'Zinhle',
    'Palesa',
    'Naledi',
    'Refilwe',
    'Karabo',
    'Buhle',
    'Thandi',
  ],
};

export type Slang = (typeof SLANG)[number];

/**
 * Fictional convenience store / spaza shop names for dispatch templates.
 * Source: lore-bible §1 (composite SA metropolis, Joburg/Yeoville/Hillbrow analogues).
 */
export const CONVENIENCE_STORES = [
  'Yeoville Corner Shop',
  'Hillbrow Spaza',
  'Kasi Quick Mart',
  'Diepkloof General',
  'Braamfontein 24/7',
  'Fordsburg Mini Market',
  'Alexandra Tuck Shop',
  'Tembisa Corner Store',
] as const;

/**
 * Common vehicle colors used in dispatch descriptions.
 * SA-authentic mix of English + Afrikaans street terms (lore-bible §3).
 * No brand/model references.
 */
export const VEHICLE_COLORS = [
  'white',
  'wit',
  'silver',
  'silwer',
  'black',
  'swart',
  'red',
  'rooi',
  'blue',
  'blou',
  'grey',
  'grys',
  'green',
  'groen',
  'dark green',
  'dark blue',
] as const;

/**
 * Inlined dispatch templates — keyed by 3-digit ID, value is the raw `.tmpl`
 * text with `{{placeholders}}` still in place. Substitutions are applied by the
 * dispatch engine (`buildTier0Summary`). Inlined (not loaded from `.tmpl` files)
 * so the templates ship with the compiled package and work inside containers
 * where `src/templates` is not present.
 *
 * Editing rules: keep text under 240 chars, keep at most one `{{...}}` per line
 * of dialogue, and stay aligned with lore-bible §dispatch tone.
 */
export const DISPATCH_TEMPLATES: Record<string, string> = {
  '001':
    "Eish, all units — we've got a hijacking at Hillbrow taxi rank. Suspect fled south in a {{vehicle.color}} sedan. {{slang.casual}} bra, move now!",
  '002':
    'Control to all units in the kasi — robbery in progress at Yeoville corner shop. Two suspects, one armed with a firearm. {{slang.street}}, respond asap.',
  '003':
    'Units, units — body found in Alexandra Section 7. Looks like a hit. {{name.given.m}} {{name.surname}} reporting from scene. Perimeter up, nobody in or out.',
  '004':
    'Shots fired near Braamfontein campus. Multiple witnesses running. Suspect last seen heading towards the CBD. All available units requested.',
  '005':
    'Attention, attention — a CIT truck robbery attempted at Sandton Drive. Suspects in a red bakkie, registration unknown. Armed and dangerous. Do not approach without backup.',
  '006':
    'Drug deal spotted at the Newtown underpass — three males, one female. Unit {{name.given.m}} {{name.surname}} requesting backup before moving in. {{slang.casual}}, this one looks serious.',
  '007':
    'Vehicle pursuit active — stolen {{vehicle.color}} hatchback heading north on Louis Botha. Driver reckless, running lights. Any unit in range, cut them off at the bridge.',
  '008':
    'Code 10 at Soweto Diepkloof — domestic dispute turned violent. Neighbours called it in. Tread soft, {{slang.street}}, there are kids inside.',
  '009':
    "Alert: suspicious package reported outside the Magistrate's Court, CBD. Bomb disposal requested. All units maintain 100-metre cordon. No civilians in the zone.",
  '010':
    'Update on the Hillbrow incident — suspect apprehended by {{name.given.m}} {{name.surname}}. Victim transported to Helen Joseph. Scene is clear. {{slang.casual}}, good work out there.',
};

/**
 * ElevenLabs voice ID for the PPS (Provincial Police Service) dispatcher.
 * Canonical voice for AI dispatch audio — change requires ADR.
 * Value is the ElevenLabs voice ID string; set ELEVENLABS_DISPATCH_VOICE_ID env to override.
 */
export const DISPATCH_VOICE_ID = 'ErXwobaYiN019PkySvjV' as const;
