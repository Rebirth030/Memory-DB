# CLAUDE.md

> Short, high-signal instructions for Claude Code. Read this first, always.

## Project

**What:** A local SQLite + FTS5 personal-memory store for AI assistants, exposed
via a FastMCP server, with a human-in-the-loop approval flow.
**Stack:** Python ≥3.14, stdlib `sqlite3` + FTS5, Pydantic v2, FastMCP (stdio),
FastAPI (JSON API), React + Vite (frontend), uv.
**Who uses it:** AI assistants (Claude, Codex) read/propose; the human reviews.

## Before You Code

1. Read `docs/architecture.md` — the store/transport split and data model
2. Read `docs/conventions.md` — layering, SQL-safety, commands
3. Check `docs/decisions/` — **ADR-001 (approval flow) is LOCKED**

## Working Rules (project-specific)

- **Never change the approval flow** (ADR-001). Model suggests candidates only;
  the human approves/rejects. The model must ask the user before any **approve,
  reject, or edit** (`update_memory`) and never act on its own.
- **Consolidate, don't fragment.** One memory per specific topic. Search first;
  if the topic exists, **supersede** it to fold in new detail (not a duplicate).
  New memories only for a genuinely new topic, or to split a multi-topic memory.
  `update_memory` is only for trivial typo/wording fixes.
- **Store stays transport-free** (ADR-002): no `fastmcp` imports in
  `personal_mem_store.py`. New behavior = store function + thin MCP wrapper.
- **Secrets** (ADR-003): model may write any sensitivity; read tools never return
  `sensitive`/`secret`. **Never expose `list_memories` via MCP** (it returns
  secrets and every status), and the same goes for `purge_mem` — permanent
  deletion is a human action in the web UI, never an assistant's.
- **SQL:** bind all values; inline only allowlisted columns/operators.
- **No personal data** in code; seeds/tests are anonymous.
- Run `uv run python personal_mem_test.py` before finishing (22 tests).
- `python` is not on PATH → use `uv run python`, which works on every OS
  (direct paths: `.venv/Scripts/python.exe` on Windows, `.venv/bin/python`
  on macOS/Linux).

## Files

- `personal_mem_store.py` — domain layer (logic + models + `StoreError`)
- `personal_mem_mcp.py` — FastMCP server (5 thin tools)
- `api/app.py` — FastAPI JSON API (transport 2, localhost admin)
- `frontend/` — React + Vite SPA (localhost admin/review UI)
- `memory_init.py` — schema setup · `personal_mem_test.py` — seeds + 24 tests
- `memory.db` — the store (source of truth)

## Memory Updates

When you learn something permanently useful about this project, put it in the
relevant doc (`docs/architecture.md`, `docs/conventions.md`, or a new ADR)
rather than re-explaining it every chat.
