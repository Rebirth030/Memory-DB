# AGENTS.md

General instructions for AI coding agents working on this project.
Applies to Claude, Codex, and any other agent with filesystem access.

## Start of Every Session

Read context files in this order before doing anything else:

1. `CLAUDE.md`
2. `docs/architecture.md`
3. `docs/conventions.md`
4. `docs/decisions/` (skim README, read relevant ADRs — **ADR-001 is locked**)

Do not start reading arbitrary source files until you have read these.

## Project in One Line

A local SQLite + FTS5 personal-memory store exposed to AI assistants via a
FastMCP server, with a human-approval flow. A localhost FastAPI JSON API and a
React + Vite frontend provide the review UI ([ADR-004](docs/decisions/ADR-004-react-vite-frontend.md)).

## Non-Negotiable Rules

- **Do not change the approval flow** (ADR-001): model suggests candidates, human
  approves/rejects, supersede happens at approval time. The model must ask the
  user before any **approve, reject, or edit** (`update_memory`) — never act on
  its own.
- **Search before creating a memory:** before `suggest_memories`, check for an
  existing one (`search_memories`); if found, update it (same fact) or supersede
  it (changed fact) rather than duplicating.
- **Keep the store transport-free** (ADR-002): no `fastmcp`/HTTP imports in
  `personal_mem_store.py`. New ops = store function + thin transport wrapper.
- **Secrets** (ADR-003): writes may use any sensitivity; read tools never return
  `sensitive`/`secret`. Never expose `list_memories` (all statuses/sensitivities) or `purge_mem` (permanent deletion — web UI only)
  via MCP.
- **SQL safety:** bind values; inline only allowlisted identifiers/operators.
- **No personal data in code** — seeds and tests use anonymous samples.

## General Working Rules

- Make the smallest change that accomplishes the goal.
- Don't refactor unrelated code while fixing a bug.
- Don't add dependencies without checking existing patterns first.
- When unsure about intent: stop and ask, don't assume.

## After Changes

- Run the test suite: `uv run python personal_mem_test.py` (22 tests).
- Note any permanent architectural decision in `docs/decisions/`.

## Security Rules

- Never log, commit, or store real secrets, tokens, passwords, or keys in code.
- Never expose internal paths or credentials in comments or docs.

## Environment Notes

- `python` is not on PATH — use `uv run python` (works on every OS; the direct
  paths are `.venv/Scripts/python.exe` on Windows, `.venv/bin/python` elsewhere).
- Managed with **uv**; Python `>=3.14`.
