# M1 — Data Model & Event Bus

Depends on: M0 complete (lockfile committed, all app stubs boot, CI green).

Dependency graph within M1:

```
M1-A Prisma migration ─┬─► M1-B Seed
                       └─► M1-E Reputation engine
M1-C event-bus pkg ────┬─► M1-D Backend /events
                       └─► M1-F BullMQ bridge ──► M1-E
```

Recommended order: A → C → D → F → B → E. A + C can run in parallel.

---

## [M1-A] Apply initial Prisma migration

**Branch**: `m1/prisma-migration-init`

**Objective**: Generate the initial migration from the schema committed in M0 and wire CI to apply it.

In scope:

- [ ] Run `pnpm -F @gtarp/db prisma migrate dev -n init` against local Postgres (Docker Compose).
- [ ] Commit `packages/db/prisma/migrations/` (whole tree, including `migration_lock.toml`).
- [ ] Update `.github/workflows/ci.yml` to run `pnpm -F @gtarp/db prisma migrate deploy` against the test Postgres service before the test step.
- [ ] Smoke check in CI: `psql $DATABASE_URL -c "SELECT 1 FROM \"Player\" LIMIT 1"` returns no error.

Out of scope:

- Schema changes. Migration must reflect committed schema verbatim. If the schema needs fixing, open a separate issue first.

Files: `packages/db/prisma/migrations/**`, `.github/workflows/ci.yml`.

Acceptance:

- `pnpm -F @gtarp/db prisma migrate deploy` runs clean against a fresh Postgres.
- CI green on the PR branch.

---

## [M1-B] Seed script with SA-flavored sample data

**Branch**: `m1/seed-sa-data`

**Depends on**: M1-A merged.

**Objective**: Extend `packages/db/prisma/seed.ts` to populate enough data for M3 vertical-slice playtests.

In scope:

- [ ] ≥20 territories (mix of GP, WC, KZN areas) from `@gtarp/sa-content`.
- [ ] ≥10 businesses across all `kind` values in the schema.
- [ ] ≥4 gangs — at minimum the four named in `docs/lore-bible.md` (Top Six, Iron Hand, Khanyisa, plus one independent crew).
- [ ] ≥6 sample players with realistic SA `Identity` rows (id number, birth date, province). Names from `@gtarp/sa-content` only.
- [ ] ≥3 families with `FamilyMember` linkages.
- [ ] Seed is idempotent — running twice does not double rows. Use `upsert` keyed on stable fields.
- [ ] Add CI smoke step: `pnpm -F @gtarp/db seed && pnpm -F @gtarp/db prisma db execute --stdin <<< "SELECT count(*) FROM \"Player\""` returns ≥6.

Out of scope:

- Real player data. Seed is synthetic only — flag every player with a fake fivemLicense prefix `seed_`.

Files: `packages/db/prisma/seed.ts`, `.github/workflows/ci.yml`.

Acceptance:

- Running seed twice produces identical row counts.
- Every name / area / surname appears in `@gtarp/sa-content`.

GTA-first justification: realistic dynasties + territory map = playtests feel like a city, not an empty map.

---

## [M1-C] `@gtarp/event-bus` package — NATS JetStream wrapper

**Branch**: `m1/event-bus-package`

**Objective**: Single library every service uses to publish/subscribe domain events. Validation happens here, not at the call site.

In scope:

- [ ] New workspace package `packages/event-bus` (TypeScript, Vitest, mirrors layout of existing packages).
- [ ] Public API:
  ```ts
  connect(opts?): Promise<EventBus>
  bus.publish(event: DomainEvent): Promise<{ seq: bigint }>
  bus.subscribe(subjectPattern: string, handler: (evt: DomainEvent, msg: JsMsg) => Promise<void>, opts?: SubscribeOpts): Promise<JetStreamSubscription>
  bus.ensureStream(name?, subjects?): Promise<void>
  bus.close(): Promise<void>
  ```
- [ ] `publish` runs the payload through `DomainEvent` from `@gtarp/event-schema` — invalid event throws `EventValidationError` _before_ hitting NATS.
- [ ] `subscribe` parses incoming messages with the same schema; bad messages go to a `<subject>.dlq` subject and ack the original.
- [ ] Stream config: name `gtarp`, subjects `gtarp.>`, retention `limits`, storage `file`, max age 30 days.
- [ ] Consumer config: durable, explicit ack, max-deliver 5, ack-wait 30s.
- [ ] Vitest contract tests: round-trip publish → subscribe → handler invoked → ack. Uses NATS service container already configured in `.github/workflows/ci.yml`.

Out of scope:

- Multi-stream topology. One stream this milestone.
- Replay tooling — separate ADR if needed.

Files: `packages/event-bus/**`, `pnpm-workspace.yaml` already covers it.

Acceptance:

- Contract test green.
- `bus.publish` of an invalid event never reaches NATS (assert via integration test).
- Publishing the same event id twice is idempotent at the consumer (handler invoked once after Redis dedup added in M1-F).

GTA-first justification: the bus is the city's memory — every reputation gain, every betrayal, every dispatch call flows through here.

---

## [M1-D] Backend `/events` ingest endpoint

**Branch**: `m1/backend-events-ingest`

**Depends on**: M1-A, M1-C.

**Objective**: HTTP endpoint that FiveM resources call to publish events. Backend is the single writer to NATS — Lua resources never touch NATS directly.

In scope:

- [ ] `POST /events` on `apps/backend`. Body: `DomainEvent` (Zod-validated via `@gtarp/event-schema`).
- [ ] Auth: header `x-fivem-ingest-token` must equal `process.env.FIVEM_INGEST_TOKEN`. Missing/wrong → 401.
- [ ] Rate limit: 50 events/sec per `x-source-id` header (use `@fastify/rate-limit` with Redis store).
- [ ] Each accepted event:
  1. Validated.
  2. Written to `EventLog` row (Prisma).
  3. Published via `@gtarp/event-bus` to subject `gtarp.<event.type>`.
- [ ] Returns `{ id, seq }` on success.
- [ ] On NATS failure after DB write: 500 + DB row marked `published=false` (add column in a follow-up migration in same PR).
- [ ] Integration test: POST a `crime.committed`, assert EventLog row + JetStream message.

Out of scope:

- mTLS. Shared-secret is temporary; M9 replaces it.
- Replay endpoint.

Files: `apps/backend/src/routes/events.ts`, `apps/backend/src/server.ts`, `packages/db/prisma/schema.prisma` + new migration, `apps/backend/package.json`.

Acceptance:

- Integration test green.
- 401 on missing token; 429 on rate limit; 400 on schema mismatch.
- `EventLog` row id matches NATS message header `Nats-Msg-Id`.

GTA-first justification: every criminal act becomes durable history the moment it's published.

---

## [M1-E] Reputation engine v1

**Branch**: `m1/reputation-engine`

**Depends on**: M1-A, M1-F.

**Objective**: Worker consumes domain events and updates `Reputation` rows deterministically. No AI.

In scope:

- [ ] Subscribes (via BullMQ from M1-F) to: `crime.committed`, `arrest.made`, `bribe.accepted`, `territory.lost`, `business.robbed`.
- [ ] Scoring table in `apps/event-worker/src/engines/reputation/scoring.ts` (pure function — input event, output `ReputationDelta[]`).
- [ ] Score formulas reflect GTA-first logic:
  - `crime.committed` of severity `serious`: +25 to perp player, +10 to gang, +5 to area "criminal" axis, -5 to area "safety".
  - `arrest.made`: -10 to suspect notoriety, +10 to officer.
  - `bribe.accepted`: +5 receiver "corruption", -5 receiver "integrity".
  - `territory.lost`: -30 losing gang, +30 winning gang.
  - `business.robbed`: -10 business "stability", +cashTaken/1000 perp notoriety (capped).
- [ ] Updates `Reputation` rows for player, family (via membership), gang (via membership), area.
- [ ] Unit tests on every scoring case (table-driven).
- [ ] Integration test: publish `crime.committed` via backend `/events`, assert all reputation deltas applied within 2s.

Out of scope:

- Decay over time — M4 issue.
- Threshold-driven progression unlocks — M4-issue.

Files: `apps/event-worker/src/engines/reputation/**`, tests.

Acceptance:

- Unit test coverage ≥90% for scoring table.
- Integration test green.
- Deterministic: same event twice produces same row state.

GTA-first justification: reputation is the permanent record — what makes the city _remember_.

---

## [M1-F] BullMQ consumer bridge + idempotency + metrics

**Branch**: `m1/bullmq-bridge`

**Depends on**: M1-C.

**Objective**: Wire NATS subscriptions into per-consumer BullMQ queues so engines scale independently.

In scope:

- [ ] In `apps/event-worker/src/bridge/`, on boot:
  - Connect to NATS via `@gtarp/event-bus`.
  - For each consumer name in `['reputation','story','media','gang','economy','dispatch']`, create a BullMQ queue + worker on Redis.
  - Subscribe to `gtarp.>` once. For each message: dedupe via Redis `SET event:<id> 1 EX 86400 NX`. If new → enqueue jobs onto every consumer queue that opted in via a registry map.
  - Consumer registry: each engine module exports `{ name, subjects, handler }`. Bridge subscribes only to the subjects each engine opted into.
- [ ] Reputation engine (built in M1-E) registers via this pattern.
- [ ] `/metrics` endpoint exposes Prometheus text: counters `gtarp_events_received_total{subject}`, `gtarp_events_deduped_total`, `gtarp_jobs_enqueued_total{queue}`, gauges `gtarp_queue_depth{queue}`.
- [ ] Idempotency test: publish same event id twice → handler invoked once.

Out of scope:

- Distributed tracing (Phase 2).
- Per-job retry policy customization beyond BullMQ defaults.

Files: `apps/event-worker/src/bridge/**`, `apps/event-worker/src/metrics.ts`.

Acceptance:

- Boot creates 6 queues idempotently.
- Idempotency test green.
- `/metrics` returns valid Prometheus text (validated by `prom-client`'s parser in test).

GTA-first justification: separate queues = a runaway media engine can't starve the dispatch loop. The criminal sandbox stays responsive.

---

## Cross-cutting acceptance for M1

Before declaring M1 done:

- [ ] `docker compose up`, then `pnpm dev` boots backend + event-worker + ai-orchestrator without errors.
- [ ] Backend integration test: `POST /events` with a `crime.committed` → row in `EventLog` → message in NATS → job consumed by `reputation` queue → `Reputation` row updated. Single E2E test ties M1-A/C/D/E/F together.
- [ ] CI green on every M1 PR.
- [ ] `/metrics` shows non-zero counters after the E2E test.
