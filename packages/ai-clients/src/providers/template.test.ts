import { describe, it, expect } from 'vitest';
import type { GenerationRequest } from '../index.js';
import { TemplateProvider } from './template.js';
import type { TemplateDeps } from './template.js';

const SLANG: TemplateDeps['slang'] = [
  { term: 'eish', register: 'casual' },
  { term: 'sharp', register: 'casual' },
  { term: 'lekker', register: 'casual' },
  { term: 'bra', register: 'street' },
  { term: 'china', register: 'street' },
  { term: 'skebenga', register: 'tsotsitaal' },
];

const SURNAMES: TemplateDeps['surnames'] = ['Mokoena', 'Dlamini', 'Khumalo'];
const FIRST_NAMES: TemplateDeps['firstNames'] = {
  m: ['Sipho', 'Thabo', 'Bongani'],
  f: ['Nomvula', 'Lerato', 'Zinhle'],
};

function makeDeps(templates: Record<string, string[]>): TemplateDeps {
  return {
    store: {
      getTemplates: (purpose: string) => templates[purpose] ?? [],
    },
    slang: SLANG,
    surnames: SURNAMES,
    firstNames: FIRST_NAMES,
  };
}

const BASE_REQ: GenerationRequest = {
  purpose: 'dispatch',
  tier: 0,
  system: '',
  user: 'All units respond.',
  cacheKey: 'test-key-001',
};

describe('TemplateProvider', () => {
  it('returns deterministic output for the same cacheKey', async () => {
    const deps = makeDeps({ dispatch: ['Hello {{name.surname}}, {{slang.casual}} out there!'] });
    const provider = new TemplateProvider(deps);

    const r1 = await provider.generate(BASE_REQ);
    const r2 = await provider.generate(BASE_REQ);

    expect(r1.text).toBe(r2.text);
    expect(r1.text).not.toContain('{{');
  });

  it('may return different output for a different cacheKey', async () => {
    const templates = [
      'Template A: {{name.surname}}',
      'Template B: {{name.surname}}',
      'Template C: {{name.surname}}',
      'Template D: {{name.surname}}',
      'Template E: {{name.surname}}',
    ];
    const deps = makeDeps({ dispatch: templates });
    const provider = new TemplateProvider(deps);

    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = await provider.generate({ ...BASE_REQ, cacheKey: `key-${i}` });
      results.add(r.text.split(':')[0] ?? '');
    }
    // With 5 templates and 20 different keys, we should see more than 1 unique template chosen
    expect(results.size).toBeGreaterThan(1);
  });

  it('applies DSL substitutions — {{name.surname}} is replaced', async () => {
    const deps = makeDeps({ dispatch: ['Officer {{name.surname}} reporting.'] });
    const provider = new TemplateProvider(deps);

    const result = await provider.generate(BASE_REQ);

    expect(result.text).not.toContain('{{name.surname}}');
    const knownSurnames = ['Mokoena', 'Dlamini', 'Khumalo'];
    expect(knownSurnames.some((s) => result.text.includes(s))).toBe(true);
  });

  it('applies all slang DSL substitutions', async () => {
    const deps = makeDeps({
      dispatch: ['{{slang.casual}} bra, {{slang.street}} skebenga says {{slang.tsotsitaal}}'],
    });
    const provider = new TemplateProvider(deps);
    const result = await provider.generate(BASE_REQ);

    expect(result.text).not.toContain('{{slang');
  });

  it('replaces {{name.given.m}} and {{name.given.f}}', async () => {
    const deps = makeDeps({
      dispatch: ['{{name.given.m}} met {{name.given.f}} at the corner.'],
    });
    const provider = new TemplateProvider(deps);
    const result = await provider.generate(BASE_REQ);

    expect(result.text).not.toContain('{{name.given');
    const allNames = [...FIRST_NAMES.m, ...FIRST_NAMES.f];
    const count = allNames.filter((n) => result.text.includes(n)).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('falls back to dispatch when purpose not found', async () => {
    const deps = makeDeps({ dispatch: ['Dispatch fallback text.'] });
    const provider = new TemplateProvider(deps);

    const result = await provider.generate({ ...BASE_REQ, purpose: 'unknown-purpose' });

    expect(result.text).toBe('Dispatch fallback text.');
  });

  it('returns user string when no templates exist at all', async () => {
    const deps = makeDeps({});
    const provider = new TemplateProvider(deps);

    const result = await provider.generate(BASE_REQ);

    expect(result.text).toBe(BASE_REQ.user);
  });

  it('returns correct GenerationResult shape', async () => {
    const deps = makeDeps({ dispatch: ['Sharp sharp.'] });
    const provider = new TemplateProvider(deps);

    const result = await provider.generate(BASE_REQ);

    expect(result.provider).toBe('template');
    expect(result.model).toBe('template-v1');
    expect(result.tier).toBe(0);
    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(result.costUsd).toBe(0);
    expect(result.cacheHit).toBe(false);
  });

  it('substitutes {{user}} with the full user string', async () => {
    const deps = makeDeps({ dispatch: ['Context: {{user}}'] });
    const provider = new TemplateProvider(deps);

    const result = await provider.generate({ ...BASE_REQ, user: 'move to sector 7' });

    expect(result.text).toBe('Context: move to sector 7');
  });

  it('resolves {{key}} from JSON-parsed user string', async () => {
    const deps = makeDeps({ dispatch: ['Hello {{name}}, you are {{age}}.'] });
    const provider = new TemplateProvider(deps);

    const result = await provider.generate({
      ...BASE_REQ,
      user: JSON.stringify({ name: 'Sipho', age: 25 }),
    });

    expect(result.text).toBe('Hello Sipho, you are 25.');
  });

  it('leaves unknown {{key}} as-is when not in parsed JSON', async () => {
    const deps = makeDeps({ dispatch: ['Status: {{unknownVar}}'] });
    const provider = new TemplateProvider(deps);

    const result = await provider.generate({ ...BASE_REQ, user: 'plain text' });

    expect(result.text).toBe('Status: {{unknownVar}}');
  });
});
