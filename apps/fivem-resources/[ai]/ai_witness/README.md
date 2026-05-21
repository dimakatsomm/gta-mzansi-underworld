# `[ai]/ai_witness`

NPC witness detection and statement capture for the AI-powered dispatch pipeline.

## What it does

- Listens for `ai_witness:crimePublished` (fired by `[crime]/robbery` and `[crime]/hijack` after a `crime.committed` event is published)
- Client-side: samples up to 8 nearby NPC peds within 40 m, estimates each witness's reliability from lighting, distance, fear, and intoxication factors
- Server-side: caps 3 witnesses per crime, calls backend `/events` to publish a `witness.observed` NATS event per witness
- Displays a brief NUI toast on all connected clients when a witness is detected
- The event-worker `witness` engine picks up `witness.observed`, generates an SA-authentic Tier 0 statement via template, and publishes `witness.statement`

## Resource layout

```
[ai]/ai_witness/
├── fxmanifest.lua
├── client.lua         # NPC sampling + quality estimation
├── server.lua         # cap enforcement + backend publish
├── .luacheckrc
├── README.md
└── html/
    ├── index.html     # NUI toast
    ├── style.css
    └── app.js
```

## Manual test plan

### Prerequisites

- Backend running on `BACKEND_URL` (default `http://host.docker.internal:3001`)
- NATS running; event-worker started
- `[crime]/robbery` or `[crime]/hijack` loaded and working

### Steps

1. Start the FiveM server: `pnpm fivem:dev`
2. Connect as a player
3. Approach the Convenience Store at **Route 68 / Harmony** (coords near `(-70, -1771, 29)`)
4. Trigger a robbery (press `E` at the till, wait for holdup)
5. Open the **server console** and verify:
   - `[ai_witness] crime crimeId=<uuid> detected X witnesses` (0–3)
   - For each witness: `[ai_witness] published witness.observed crimeId=<uuid> witnessId=<ped-id>`
6. Check event-worker logs: `[witness] statement generated crimeId=<uuid> reliability=<band>`
7. NUI toast should appear briefly ("Witness spotted") on connected clients

### Expected outcome

- `witness.observed` events appear in NATS stream `gtarp.witness.observed`
- `witness.statement` events appear in `gtarp.witness.statement`
- Redis key `witness:statement:<crimeId>:<witnessId>` exists with 4h TTL (check with `redis-cli TTL ...`)
- Re-triggering the same crime does **not** produce duplicate statements (idempotent)
