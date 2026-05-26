# GitHub Repo Settings

Target: `dimakatsomm/gta-mzansi-underworld`. Apply once. Re-apply on major workflow changes.

## Branch protection — `main`

**Settings → Branches → Add branch ruleset** (or classic Branch protection rule for `main`):

- [x] Restrict deletions
- [x] Block force pushes
- [x] Require a pull request before merging
  - Required approvals: **1**
  - [x] Dismiss stale approvals on new commits
  - [x] Require review from Code Owners
  - [x] Require approval of the most recent reviewable push
  - Allowed merge methods: **Squash** only (linear history). Disable merge commits + rebase.
- [x] Require status checks to pass
  - [x] Require branches to be up to date before merging
  - Required checks:
    - `Lint / Typecheck / Test / Build` (from `ci.yml`)
    - `Secret scan` (gitleaks)
    - `Lua CI` (from `lua-ci.yml`)
- [x] Require conversation resolution before merging
- [x] Require signed commits — _optional, recommended once team uses GPG/SSH signing_
- [x] Require linear history
- [x] Do not allow bypassing the above settings _(turn off later only for emergencies)_

## Repo-level settings

**Settings → General**:

- Default branch: `main`
- Features:
  - Issues: **on**
  - Projects: **on** (use for milestone board)
  - Wiki: **off** (docs live in repo)
  - Discussions: **on** (community channel for SA RP)
- Pull Requests:
  - [x] Allow squash merging
  - [ ] Allow merge commits
  - [ ] Allow rebase merging
  - [x] Always suggest updating pull request branches
  - [x] Automatically delete head branches

**Settings → Code security**:

- [x] Dependabot alerts
- [x] Dependabot security updates
- [x] Dependabot version updates _(create `.github/dependabot.yml`)_
- [x] Secret scanning + push protection
- [x] Code scanning (CodeQL) — enable default setup

**Settings → Actions → General**:

- Workflow permissions: **Read repository contents and packages permissions**
  - [x] Allow GitHub Actions to create and approve pull requests _(needed for Copilot agent + Dependabot)_

## Copilot coding agent

**Settings → Copilot → Coding agent**:

- [x] Enable Copilot coding agent for this repository
- Allowed users: project owner + collaborators
- Default environment: Ubuntu

After enable, agent appears as `@copilot` and can be assigned to issues.

## Labels

Create labels under **Issues → Labels**:

| Label            | Color   | Purpose                               |
| ---------------- | ------- | ------------------------------------- |
| `copilot-task`   | #6f42c1 | Issue is sized for a Copilot agent PR |
| `milestone-0`    | #0e8a16 | M0 — Foundation                       |
| `milestone-1`    | #1d76db | M1 — Data Model & Event Bus           |
| `milestone-2`    | #1d76db | M2 — AI Orchestrator                  |
| `milestone-3`    | #d93f0b | M3 — MVP Vertical Slice (ship gate)   |
| `milestone-4`    | #1d76db | M4 — Factions                         |
| `milestone-5`    | #1d76db | M5 — Gang AI & Territory              |
| `milestone-6`    | #1d76db | M6 — Family & Legacy                  |
| `milestone-7`    | #1d76db | M7 — Media & Economy                  |
| `milestone-8`    | #1d76db | M8 — Story Engine                     |
| `milestone-9`    | #1d76db | M9 — Monetization & Hardening         |
| `gta-first`      | #b60205 | Touches core crime/power/money loops  |
| `ai-cost-impact` | #fbca04 | New AI calls / cost-relevant change   |
| `event-schema`   | #0052cc | Touches `@gtarp/event-schema`         |
| `lore`           | #5319e7 | Touches lore bible / SA content       |
| `infra`          | #c5def5 | Docker / k8s / Terraform / CI         |
| `security`       | #ee0701 | Security-sensitive                    |
| `needs-adr`      | #f9d0c4 | Decision needs ADR before code        |

## CODEOWNERS teams

Create GitHub teams matching `.github/CODEOWNERS`:

- `@gtarp/core` — primary reviewers (default owner)
- `@gtarp/architecture` — reviews schema + event contracts
- `@gtarp/ai` — reviews orchestrator + ai-clients
- `@gtarp/lore` — reviews lore bible + sa-content
- `@gtarp/ops` — reviews infra + CI

Solo for now? Make yourself sole member of each team. CODEOWNERS still routes correctly; you approve.

## Issue/PR templates

Already in repo: `.github/ISSUE_TEMPLATE/copilot-task.md`, `.github/pull_request_template.md`. No further setup.

## Apply via gh CLI

If `gh` authenticated as a repo admin:

```powershell
$REPO = "dimakatsomm/gta-mzansi-underworld"

# Default branch + delete-branch-on-merge + squash-only
gh repo edit $REPO `
  --default-branch main `
  --delete-branch-on-merge `
  --enable-squash-merge `
  --enable-merge-commit=false `
  --enable-rebase-merge=false `
  --enable-issues `
  --enable-projects `
  --enable-discussions

# Branch protection ruleset (classic protection)
gh api -X PUT "repos/$REPO/branches/main/protection" `
  -F required_status_checks.strict=true `
  -F required_status_checks.contexts[]="Lint / Typecheck / Test / Build" `
  -F required_status_checks.contexts[]="Secret scan" `
  -F enforce_admins=false `
  -F required_pull_request_reviews.required_approving_review_count=1 `
  -F required_pull_request_reviews.dismiss_stale_reviews=true `
  -F required_pull_request_reviews.require_code_owner_reviews=true `
  -F restrictions= `
  -F required_linear_history=true `
  -F allow_force_pushes=false `
  -F allow_deletions=false `
  -F required_conversation_resolution=true

# Labels (run docs/scripts/setup-labels.ps1 — see below)
pwsh ./scripts/setup-labels.ps1
```

The `setup-labels.ps1` script is committed alongside this doc.
