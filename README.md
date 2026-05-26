# Mzansi Underworld — AI-Powered South African Roleplay Server

> First truly living AI-powered criminal society simulator. FiveM + QBox, themed on Joburg / Pretoria / Cape Town / Durban.

## Status

Phase 1 in progress. See [`docs/vision.md`](docs/vision.md) and the [kickoff plan](../.claude/plans/i-want-to-plan-glittery-firefly.md).

## Quick Start

```bash
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
cp .env.example .env
pnpm -F @gtarp/db prisma:migrate
pnpm dev
```

## Repo Layout

- `apps/` — runnable services (backend, ai-orchestrator, event-worker, web, discord-bot, fivem-resources)
- `packages/` — shared libs (shared-types, event-schema, db, ai-clients, sa-content)
- `infra/` — docker / k8s / terraform
- `docs/` — ADRs, lore bible, vision

## Principles

1. **GTA-first** — every feature deepens crime/power/money/reputation/chaos. Else cut.
2. **SA authenticity** — Tsotsi/Gomora tone. No stereotypes, no TikTok memes.
3. **AI cost discipline** — tiered models, semantic cache, per-hour budgets.
4. **Event-first** — gameplay emits typed events before DB writes.
5. **Ship vertical slices** — clip-worthy moments before scale.

See [`AGENTS.md`](AGENTS.md) for full rules.
