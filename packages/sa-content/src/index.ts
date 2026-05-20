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
