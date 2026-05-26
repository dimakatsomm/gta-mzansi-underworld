# VS Code Setup

## Prereqs

- **VS Code** latest
- **Node 20+** — `node --version`
- **pnpm 9+** — `npm install -g pnpm@9` or `corepack enable && corepack prepare pnpm@9 --activate`
- **Docker Desktop** for Windows (WSL2 backend recommended)
- **Git** for Windows

## First-time setup

```powershell
# from C:\gta-mzansi-underworld
pnpm install
pnpm -F @gtarp/db prisma:generate
docker compose -f infra/docker/docker-compose.yml up -d
Copy-Item .env.example .env
```

## Open workspace

```powershell
code .
```

On first open, VS Code will offer to install the recommended extensions (`.vscode/extensions.json`). Accept all. The key ones:

| Extension                                | Purpose                               |
| ---------------------------------------- | ------------------------------------- |
| GitHub.copilot + copilot-chat            | Agent + chat                          |
| Prisma.prisma                            | Schema editing                        |
| dbaeumer.vscode-eslint                   | ESLint flat config                    |
| esbenp.prettier-vscode                   | Format on save                        |
| bradlc.vscode-tailwindcss                | Tailwind autocompletion (M0 web stub) |
| sumneko.lua + overextended.cfxlua-vscode | FiveM Lua intellisense                |
| vitest.explorer                          | Test runner UI                        |
| usernamehw.errorlens                     | Inline error overlay                  |
| streetsidesoftware.code-spell-checker    | Catches typos; SA lexicon preloaded   |

## Running things

**Tasks** (`Ctrl+Shift+P → Tasks: Run Task`):

- `infra: up` / `infra: down`
- `pnpm: dev (all)` — all apps in watch
- `ci: full` — lint + typecheck + test + build (matches CI)
- `prisma: studio` — DB inspector
- `prisma: migrate dev`

**Debug** (`F5` or Run panel):

- Per-app launch configs
- Compound `stack: backend + ai-orchestrator + event-worker`
- `vitest: current file`

## Copilot agent flow

Copilot in VS Code has three modes for this repo:

### 1. Inline (autocomplete)

Just type. Copilot suggests. Bound by `AGENTS.md` because `github.copilot.chat.codeGeneration.useInstructionFiles` is on and points to `AGENTS.md` + `.github/copilot/AGENTS.md` (see `.vscode/settings.json`).

### 2. Chat (Ctrl+Alt+I)

Ask questions. Reference files with `#file:path`. Reference symbols with `#sym:Name`. The `@workspace` agent has whole-repo context.

Examples:

```
@workspace explain how dispatch events flow from FiveM to discord-bot per the plan in #file:docs/copilot-issues/m3-mvp-vertical.md
```

```
#file:docs/copilot-issues/m1-data-event-bus.md implement the Reputation engine v1 issue. follow #file:AGENTS.md.
```

### 3. Agent mode (Ctrl+Shift+I, click the Agent toggle)

Multi-turn, multi-file. Best for landing a full issue as one PR. Paste a Copilot issue body from `docs/copilot-issues/` directly.

### Kickoff prompt

First task to give the agent: paste `docs/copilot-issues/KICKOFF-PROMPT.md` into Agent mode. It implements all M0 remainders.

## After the first PR lands

For each subsequent issue:

1. Open `docs/copilot-issues/m<N>-<topic>.md`.
2. Copy one issue's body (between two `---`).
3. Open Copilot Chat in Agent mode.
4. Paste body, prefix with: `Implement this issue as a single PR on a new branch. Follow AGENTS.md.`
5. Review the PR carefully — agent's PR description must include GTA-first justification and (if AI used) cost block.

## Spawning Copilot agents on GitHub instead

If you want PRs landed from the cloud (no local agent run):

1. Push the repo to GitHub.
2. Use `gh issue create --body-file docs/copilot-issues/m0-foundation.md`.
3. Assign the issue to `@copilot` (requires Copilot coding agent enabled on the repo).
4. Copilot opens a PR; review locally with `gh pr checkout <num>`.

## Troubleshooting

- **ESLint not running**: check `eslint.useFlatConfig: true` and reload window.
- **Prisma client missing types**: run task `prisma: generate`.
- **Lua globals red-underlined**: ensure `sumneko.lua` and `overextended.cfxlua-vscode` are installed; reload window.
- **Docker compose fails on Windows**: ensure WSL2 + Docker Desktop, `docker --version` works in PowerShell.
- **Husky hook not firing**: run `pnpm prepare` once after fresh clone.
