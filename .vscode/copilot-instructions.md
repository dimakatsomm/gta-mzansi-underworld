# Copilot Instructions — Mzansi Underworld

This file is auto-loaded by GitHub Copilot Chat when `github.copilot.chat.codeGeneration.useInstructionFiles` is true.

## Canonical sources

- Rules: [`/AGENTS.md`](../AGENTS.md) and [`/.github/copilot/AGENTS.md`](../.github/copilot/AGENTS.md).
- Vision: [`/docs/vision.md`](../docs/vision.md).
- Lore: [`/docs/lore-bible.md`](../docs/lore-bible.md). Canon. Do not contradict.
- ADRs: [`/docs/adr/`](../docs/adr/). Locked decisions.
- Active milestones: [`/docs/copilot-issues/`](../docs/copilot-issues/).

## Behavior

- Default to Tier 0 templates for AI generation. Promote only with PR-described justification.
- Every gameplay action emits a typed event from `@gtarp/event-schema` before any DB write outside `EventLog`.
- All SA names / places / slang come from `@gtarp/sa-content`. Missing? Add an entry with a citation in the same PR.
- Write tests. Vitest for TS, busted (or documented manual plan) for Lua.
- Branch `m<N>/<slug>`. Conventional Commits. One PR per issue.
- Never `--no-verify`. Never amend `main`. Never commit secrets.
