# Copilot Kickoff Prompt

Paste this into the first GitHub Copilot agent task. Self-contained — agent has no prior context.

---

You are the first coding agent on this repo. The monorepo scaffold has already been committed (see `README.md`, `AGENTS.md`, `docs/vision.md`, `docs/lore-bible.md`, `docs/adr/`, and `docs/copilot-issues/`).

Your task is to land **Milestone 0 remainders** as a single PR. Do not exceed this scope. If you discover unrelated work, open a follow-up issue instead of bundling.

## Required reading (in order)

1. `AGENTS.md` — repo rules. The GTA-first test, SA authenticity, AI cost discipline, event-first, and tests-required rules apply to every line you write.
2. `docs/vision.md` — what we are building and why.
3. `docs/lore-bible.md` — canon. Do not contradict it. Names, places, slang come from `packages/sa-content` only.
4. `docs/adr/0001..0005` — locked architectural decisions.
5. `docs/copilot-issues/m0-foundation.md` — the exact M0 remainder list.

## Deliverables

Implement every issue in `docs/copilot-issues/m0-foundation.md` in this PR. Specifically:

1. **Lockfile + first install** — run `pnpm install`, `pnpm -F @gtarp/db prisma:generate`, then `pnpm lint typecheck test build`. Commit `pnpm-lock.yaml`. CI must be green.
2. **Husky wire-up** — `pnpm prepare`, verify `.husky/pre-commit` runs `lint-staged` on a test commit. Document the no-`--no-verify` policy in `AGENTS.md`.
3. **Lua linting baseline** — add `.luacheckrc` with QBox + FiveM globals, and `.github/workflows/lua-ci.yml`. Workflow must pass on a repo with zero Lua files.
4. **`apps/web` stub** — Next.js 15 + Tailwind + TS. One static landing page at `/` with a hero block and a Discord-invite placeholder. Wire into Turbo and root scripts. CI builds it.
5. **`apps/backend` stub** — Fastify + TS. `/healthz` returns `{ status: 'ok', sha, time }`. Vitest unit test for the handler. Reads env from `.env` (use `dotenv`). Boots on port from `BACKEND_PORT`.
6. **`apps/event-worker` stub** — Node + TS process. Connects to NATS + Redis. Creates the `gtarp` JetStream if absent. Heartbeats every 30s. Exposes `/healthz`. Graceful SIGTERM.
7. **`apps/ai-orchestrator` stub** — Fastify + TS. `/generate/text` and `/generate/voice` both return `501 Not Implemented`. Define request Zod schemas — contract tests must pass.
8. **`apps/discord-bot` stub** — discord.js v14. Logs in if `DISCORD_BOT_TOKEN` is set; otherwise exits cleanly with code 0 (so CI does not need a token). Registers and acks `/ping`.

## Constraints

- Every new dependency: one-line rationale in PR description.
- No new AI calls in this PR (M2 territory).
- No new event types in this PR (M1 territory). The orchestrator stubs that exist should compile against `@gtarp/event-schema` types only.
- Branch name: `m0/remainders`. Commits Conventional Commits.
- One PR. If scope grows beyond ~25 files, stop and open a follow-up issue.

## Acceptance

- `pnpm lint typecheck test build` green locally and in CI.
- `docker compose -f infra/docker/docker-compose.yml up -d` boots and all four stubs connect to their dependencies (manual smoke documented in PR).
- All five new apps appear in `pnpm-workspace.yaml`'s expansion (i.e. `pnpm -r ls` lists them).
- PR description filled out per `.github/pull_request_template.md`, including the GTA-first justification (for stubs: "scaffolds the city's nervous system — every later GTA mechanic publishes through these").

## What to do when stuck

- Architectural ambiguity → open ADR in `docs/adr/` as part of the PR.
- SA-content gap (slang, place, name) → add an entry to `packages/sa-content/src/index.ts` in the same PR, cite source in PR description.
- Tooling failure → fix root cause. Do not `--no-verify`, do not skip CI.

Start by reading the five files listed under "Required reading," then plan, then implement. Land one focused PR.
