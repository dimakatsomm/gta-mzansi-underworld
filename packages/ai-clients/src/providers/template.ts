import type { TextProvider, GenerationRequest, GenerationResult } from '../index.js';

export interface TemplateStore {
  getTemplates(purpose: string): readonly string[];
}

export interface TemplateDeps {
  store: TemplateStore;
  slang: ReadonlyArray<{ term: string; register: string }>;
  surnames: readonly string[];
  firstNames: { readonly m: readonly string[]; readonly f: readonly string[] };
}

function mulberry32(seed: number): () => number {
  return () => {
    let s = (seed += 0x6d2b79f5);
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function strToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickFrom<T>(arr: readonly T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

export class TemplateProvider implements TextProvider {
  private readonly deps: TemplateDeps;

  constructor(deps: TemplateDeps) {
    this.deps = deps;
  }

  async generate(req: GenerationRequest): Promise<GenerationResult> {
    const seedStr = req.cacheKey ?? req.user;
    const seed = strToSeed(seedStr);
    const rng = mulberry32(seed);

    let templates = this.deps.store.getTemplates(req.purpose);
    if (templates.length === 0) {
      templates = this.deps.store.getTemplates('dispatch');
    }
    if (templates.length === 0) {
      return {
        text: req.user,
        provider: 'template',
        model: 'template-v1',
        tier: 0,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        cacheHit: false,
      };
    }

    const template = pickFrom(templates, rng) ?? req.user;
    const resolvedText = this.applySubstitutions(template, req.user, rng);

    return {
      text: resolvedText,
      provider: 'template',
      model: 'template-v1',
      tier: 0,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      cacheHit: false,
    };
  }

  private applySubstitutions(template: string, user: string, rng: () => number): string {
    const { slang, surnames, firstNames } = this.deps;

    const casualSlang = slang.filter((s) => s.register === 'casual');
    const streetSlang = slang.filter((s) => s.register === 'street');
    const tsotsitaalSlang = slang.filter((s) => s.register === 'tsotsitaal');

    let result = template;

    result = result.replace(/\{\{slang\.casual\}\}/g, () => pickFrom(casualSlang, rng)?.term ?? '');
    result = result.replace(/\{\{slang\.street\}\}/g, () => pickFrom(streetSlang, rng)?.term ?? '');
    result = result.replace(/\{\{slang\.tsotsitaal\}\}/g, () => pickFrom(tsotsitaalSlang, rng)?.term ?? '');
    result = result.replace(/\{\{name\.surname\}\}/g, () => pickFrom(surnames, rng) ?? '');
    result = result.replace(/\{\{name\.given\.m\}\}/g, () => pickFrom(firstNames.m, rng) ?? '');
    result = result.replace(/\{\{name\.given\.f\}\}/g, () => pickFrom(firstNames.f, rng) ?? '');
    result = result.replace(/\{\{user\}\}/g, user);

    // Resolve remaining {{key}} from JSON-parsed user, or leave as-is
    let parsed: Record<string, unknown> | null = null;
    try {
      const p = JSON.parse(user) as unknown;
      if (typeof p === 'object' && p !== null && !Array.isArray(p)) {
        parsed = p as Record<string, unknown>;
      }
    } catch {
      // not valid JSON — leave parsed as null
    }

    result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      if (parsed !== null) {
        const val = parsed[key];
        if (val !== undefined) return String(val);
      }
      return `{{${key}}}`;
    });

    return result;
  }
}
