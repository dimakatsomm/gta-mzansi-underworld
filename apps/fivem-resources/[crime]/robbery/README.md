# `[crime]/robbery` — Manual Test Plan

## Purpose

Holdup at convenience store till. Publishes `crime.committed` event via backend `/events`.
Triggers AI dispatch chatter end-to-end (robbery → crime.committed → dispatch.requested → NUI card + audio).

## GTA-first justification

Crime is the centre of the world (vision.md §Design Principles). A single robbery by one player
triggers the dispatch audio loop — the highest-clip-yield surface of M3.

## Prerequisites

1. `docker compose -f infra/docker/docker-compose.yml up -d` — Postgres, Redis, NATS running.
2. `pnpm fivem:dev` — FiveM server + txAdmin up.
3. `pnpm dev` from repo root — backend + event-worker + ai-orchestrator running.
4. Player spawned with a police job in-game so dispatch audio is heard.

## Test steps

### Step 1 — Trigger robbery

1. Spawn at Yeoville Corner Shop (coords approx 372.3, 328.6, 103.6 in-world).
2. Walk into the yellow interaction zone.
3. Press `G` (default keybind `robbery_holdup`).
4. Player should play hands-up animation for ~3 seconds.

### Step 2 — Verify crime.committed published

Check backend logs for:

```text
[events] crime.committed crimeId=<uuid> published seq=<n>
```

Check NATS monitor at http://localhost:8222/jsz for message on `gtarp.crime.committed`.

### Step 3 — Verify dispatch engine processed

Check event-worker logs for:

```text
[dispatch] summary tier=0 cached=false crimeId=<uuid>
[dispatch] published dispatch.requested incidentId=<uuid> crimeId=<uuid>
```

### Step 4 — Verify NUI card + audio

Within 5 seconds of Step 1:

- A dispatch incident card appears on-screen for the police player:
  - Severity colour: **yellow** (minor).
  - Area: `yeoville` (or similar SA area).
  - Summary text: SA English dispatch chatter.
- Dispatch audio plays via in-game radio effect.

### Step 5 — Verify idempotency

1. Trigger a second holdup with the **same** `crimeId` (simulate retry via curl):
   ```bash
   curl -X POST http://localhost:3001/events \
     -H "Content-Type: application/json" \
     -H "x-fivem-ingest-token: <token>" \
     -d @/tmp/test-crime.json
   ```
2. Event-worker logs should show `skipping crimeId=… — already dispatched`.
3. No duplicate dispatch.requested event should appear on NATS.

## Expected outcome

- `crime.committed` visible in NATS within 500 ms of pressing G.
- `dispatch.requested` visible within 2 s.
- NUI card + audio within 5 s of pressing G.
- No duplicate dispatch on retry.
