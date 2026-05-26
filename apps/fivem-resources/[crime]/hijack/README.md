# `[crime]/hijack`

Vehicle hijack resource for Mzansi Underworld. Client detects nearby slow/parked vehicles; server validates distance, applies a 45-second cooldown, and publishes a typed `crime.committed` event (`crimeType: "hijack"`, `severity: "major"`) to the backend `/events` endpoint.

## Dependencies

| Dependency | Purpose                              |
| ---------- | ------------------------------------ |
| `ox_lib`   | Text-UI hints + keybind registration |
| `qbx_core` | QBox job integration                 |

## Setup

Ensure the following convars are set in `server.cfg`:

```
set BACKEND_URL "http://<backend-host>:3001"
set FIVEM_INGEST_TOKEN "<secret>"
```

## Manual Test Plan

### Prerequisites

1. Backend running (`pnpm dev` in `apps/backend`)
2. FiveM server with QBox + ox_lib + ox_inventory started
3. Player spawned in-game

### Steps

1. **Spawn near a parked vehicle** (any car model works)
2. **Approach the vehicle** — within ~5 m
3. Text UI hint `[G] Hijack vehicle` should appear at the bottom of screen
4. **Press G**
5. Verify server console prints:
   ```
   [hijack] published crime.committed crimeId=<uuid> player=<id>
   ```
6. Verify backend receives `POST /events` with `type: "crime.committed"`, `crimeType: "hijack"`, `severity: "major"`
7. Check dispatch audio fires within 5s (if ai_dispatch resource is running)

### Anti-cheat checks

- While more than 8 m from any vehicle, press G → no event fires
- Trigger two hijacks within 45s → second attempt shows "Wara wara" notify
- Teleport cheat to fake coords → server rejects (distance > 8 m)
