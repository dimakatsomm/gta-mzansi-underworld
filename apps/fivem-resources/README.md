# FiveM Resources — Mzansi Underworld RP

QBox-based FiveM server data. Boots via `pnpm fivem:dev` from the repo root.

## Prerequisites

- Docker Desktop running.
- A valid FiveM licence key (https://keymaster.fivem.net).
- `.env` file in this directory with the variables listed in the **Environment variables** section below.

## First-time setup

```bash
# 1 — Fetch QBox framework dependencies (ox_lib, ox_inventory, qbx_core)
pnpm fivem:deps   # from repo root — shallow-clones pinned versions

# 2 — Copy the config template
cp server.cfg.template server.cfg

# 3 — Edit server.cfg: fill sv_licenceKey, FIVEM_INGEST_TOKEN
vim server.cfg   # or any editor

# 4 — Start the stack
pnpm fivem:dev   # from repo root — starts txAdmin container
```

> **Git submodules alternative**: if cloned with `--recurse-submodules` the deps
> are already present. To update pinned versions later see the **Updating** section below.

The txAdmin UI is at http://localhost:40120. First run prompts for a PIN.

## Resource layout

```text
[crime]/
  robbery/       — Holdup at convenience store till → crime.committed event
[ai]/
  ai_dispatch/   — Dispatch NUI card + voice audio for police job
  ai_witness/    — NPC witness sampling → witness.observed events
```

## Pinned dependency versions

| Resource     | Version | Source                                       |
| ------------ | ------- | -------------------------------------------- |
| ox_lib       | 3.14.0  | https://github.com/overextended/ox_lib       |
| ox_inventory | 2.35.1  | https://github.com/overextended/ox_inventory |
| qbx_core     | 1.37.0  | https://github.com/Qbox-project/qbx_core     |

**To update — deps script path** (default, no git submodules):

1. Bump version tags in `server.cfg.template` and `scripts/fetch-deps.mjs`.
2. Delete the old dep directories (`ox_lib/`, `ox_inventory/`, `qbx_core/`).
3. Re-run `pnpm fivem:deps`.

**To update — git submodules path** (if you cloned with `--recurse-submodules`):

1. Update the recorded submodule commit: `git -C apps/fivem-resources/<name> fetch --tags && git -C apps/fivem-resources/<name> checkout v<new-tag>`.
2. Stage the submodule pointer: `git add apps/fivem-resources/<name>`.
3. Run `pnpm fivem:update` to confirm all submodules match the recorded commits.

## Environment variables

| Variable              | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `SV_LICENCEKEY`       | FiveM server licence key                                        |
| `FIVEM_INGEST_TOKEN`  | Shared secret between FiveM server and backend                  |
| `BACKEND_URL`         | Backend base URL (default: http://host.docker.internal:3001)    |
| `AI_ORCHESTRATOR_URL` | AI orchestrator URL (default: http://host.docker.internal:3002) |

## Manual smoke test (robbery → dispatch audio)

See `[crime]/robbery/README.md` for the step-by-step test plan.
