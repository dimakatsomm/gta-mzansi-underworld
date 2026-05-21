# FiveM Resources — Mzansi Underworld RP

QBox-based FiveM server data. Boots via `pnpm fivem:dev` from the repo root.

## Prerequisites

- Docker Desktop running.
- A valid FiveM licence key (https://keymaster.fivem.net).
- `.env` file in this directory (copy `.env.example` and fill values).

## First-time setup

```bash
# 1 — Copy the config template
cp server.cfg.template server.cfg

# 2 — Edit server.cfg: fill sv_licenceKey, FIVEM_INGEST_TOKEN
vim server.cfg   # or any editor

# 3 — Start the stack
pnpm fivem:dev   # from repo root — starts txAdmin container
```

The txAdmin UI is at http://localhost:40120. First run prompts for a PIN.

## Resource layout

```text
[crime]/
  robbery/       — Holdup at convenience store till → crime.committed event
[ai]/
  ai_dispatch/   — Dispatch NUI card + voice audio for police job
```

## Pinned dependency versions

| Resource     | Version | Source                                       |
| ------------ | ------- | -------------------------------------------- |
| ox_lib       | 3.14.0  | https://github.com/overextended/ox_lib       |
| ox_inventory | 2.35.1  | https://github.com/overextended/ox_inventory |
| qbx_core     | 1.37.0  | https://github.com/Qbox-project/qbx_core     |

To update: change version tags in `server.cfg.template` and re-run `pnpm fivem:update`.

## Environment variables

| Variable              | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `SV_LICENCEKEY`       | FiveM server licence key                                        |
| `FIVEM_INGEST_TOKEN`  | Shared secret between FiveM server and backend                  |
| `BACKEND_URL`         | Backend base URL (default: http://host.docker.internal:3001)    |
| `AI_ORCHESTRATOR_URL` | AI orchestrator URL (default: http://host.docker.internal:3002) |

## Manual smoke test (robbery → dispatch audio)

See `[crime]/robbery/README.md` for the step-by-step test plan.
