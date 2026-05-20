# AGENTS.md — Rules for Copilot / AI Coding Agents

Every agent working in this repo must follow these rules. PRs violating them will be rejected.

## 1. GTA-First Test

Every feature must deepen one of: **crime, power, money, reputation, chaos, freedom, survival**.

In every PR description, include a "GTA-first justification" sentence. If you cannot write one without stretching, the feature does not belong in Phase 1.

## 2. South African Authenticity

- Tone reference: Tsotsi, Gomora, Yizo Yizo, The Queen, Blood & Water.
- **Do not** use stereotypes, poverty tourism, or TikTok meme tropes.
- Names, slang, places, and music references must come from `packages/sa-content`. If something is missing there, add it (with sources) before using it elsewhere.
- The lore bible at `docs/lore-bible.md` is canon. Disagree with it? Open an ADR, do not contradict it in code.

## 3. AI Cost Discipline

Any new AI call requires, in the PR description:

- **Tier** (0 templates / 1 Haiku-class / 2 Sonnet-class / 3 Opus-class) and a sentence on why a lower tier was rejected.
- **Cache strategy**: cache key, expected hit rate, TTL.
- **Budget impact**: estimated tokens per call × calls per active-player-hour.

Default to Tier 0. Tier 3 needs an ADR.

## 4. Event-First

Gameplay actions emit a typed event to NATS before any direct DB write outside the event log. Events are defined in `packages/event-schema` (Zod). Adding a new event = a one-line PR to the schema package first.

## 5. Tests Required

- TypeScript: Vitest. Unit + contract tests for every new export.
- Lua FiveM resources: busted where feasible; otherwise a documented manual test plan.
- Event schemas: contract tests proving backward compatibility.

## 6. One Concern Per PR

Issues are sized for a single PR. If your PR touches more than one milestone's scope, split it.

## 7. Commits & Branches

- Branch naming: `m<milestone>/<short-slug>` (e.g. `m0/init-monorepo`).
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- No force push to `main`. PRs require CI green + 1 reviewer.

## 8. Secrets

Never commit secrets. `.env.example` lists every required key. CI fails on detected secrets (gitleaks).

## 9. Lua / FiveM Specifics

- Resources live under `apps/fivem-resources/[<category>]/<resource-name>`.
- Server-side mutations go through `packages/event-bus` via the backend, never direct DB.
- Client NUI keeps UI only; logic on server side.

## 10. When In Doubt

Open an ADR in `docs/adr/`. Cheap to write, saves arguments later.

## 11. Commit Hooks — No `--no-verify` Policy

`pnpm prepare` installs Husky. The `.husky/pre-commit` hook runs `lint-staged` on every commit.

**Never pass `--no-verify` to bypass the hook** without explicit written sign-off from the project owner in the relevant GitHub issue. Bypassing hooks without approval is grounds for PR rejection.

If a hook is blocking a legitimate commit (e.g., auto-generated file that cannot be linted), open an issue to fix the root cause. Workarounds that silence the tooling are not acceptable.
