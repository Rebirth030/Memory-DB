# personal-memory

A local, controllable memory store for AI assistants. SQLite (+ FTS5) is the
source of truth, an **MCP server** is how assistants read and propose, and a
small **React web UI** is where you — the human — approve, edit and browse.

The point is control: an assistant can only ever *suggest* a memory. It lands as
a `candidate`, stays invisible to search, and becomes part of your knowledge base
only once you approve it.

```
                    ┌─ personal_mem_mcp.py   MCP (assistants: read + suggest)
personal_mem_store.py ─┤
  domain layer,        └─ api/app.py         FastAPI (you: review/admin UI)
  transport-free              │
       │                      └─ frontend/   React SPA
   SQLite (memory.db)
```

## Requirements

- **Python ≥ 3.14** — `uv python install 3.14` if you don't have it
- **[uv](https://docs.astral.sh/uv/)** for dependencies
- **Node ≥ 20** (only for the web UI)

## Setup

Commands below use `uv run`, which picks the right interpreter on every OS. If
you'd rather call the venv directly, it's `.venv/bin/python` on macOS/Linux and
`.venv\Scripts\python.exe` on Windows.

### 1. Install

```bash
git clone https://github.com/Rebirth030/personal-memory-DB.git && cd personal-memory-DB
uv sync
```

### 2. Check that FTS5 is available

The full-text search needs SQLite compiled with FTS5. It almost always is, but
it's a one-liner to be sure — and a confusing failure later if it isn't:

```bash
uv run python -c "import sqlite3; sqlite3.connect(':memory:').execute('CREATE VIRTUAL TABLE t USING fts5(x)'); print('FTS5 OK')"
```

### 3. Create the database

The database is **not** in git — it's your data. Create an empty one:

```bash
uv run python memory_init.py        # creates ./memory.db with the schema
```

Or, to try the UI with fictional sample data first:

```bash
uv run python seed_demo.py          # creates ./demo.db, full of demo memories
```

Moving to a new machine? Just copy `memory.db` across — it's a single file.

### 4. Register the MCP server

```bash
claude mcp add personal-mem -- uv --directory /absolute/path/to/personal-memory run python personal_mem_mcp.py
claude mcp list                     # should list 'personal-mem'
```

To pin a specific database (see [Multiple stores](#multiple-stores) below), add
`--env PERSONAL_MEM_DB=/absolute/path/to/some.db`.

> The MCP server is a long-lived process started by the client. If you change the
> database path, **fully restart Claude Code** — a new chat alone keeps the old
> process, and with it the old path.

### 5. Tell your assistant what to remember

The MCP gives an assistant the *ability* to store memories; it doesn't tell it
*what* is worth storing. That belongs in your global `~/.claude/CLAUDE.md`, so
every project inherits it.

Easiest way: open Claude Code and ask it to set this up with you —

> "Help me set up my personal-mem capture rules in my global CLAUDE.md. Ask me
> the onboarding questions first."

It will interview you (what to capture, what never to capture, how often to ask)
and write the result. Keep the rules narrow at first: over-broad rules flood your
review queue, and a queue you rubber-stamp defeats the whole point.

## The web UI

### Development (two processes, hot reload)

```bash
uv run fastapi dev api/app.py       # API on :8000, docs at /docs
cd frontend && npm run dev          # UI on :5173, proxies /memories → :8000
```

### Always-on (one process, one port)

Build the frontend once; the API then serves it from the same process, so there's
no Vite server and no proxy:

```bash
cd frontend && npm run build        # produces frontend/dist
uv run fastapi run api/app.py --host 127.0.0.1       # everything on http://127.0.0.1:8000
```

To keep it running across reboots, see [`deploy/`](deploy/) — there's a launchd
plist for macOS.

> **Keep it bound to localhost.** This API deliberately returns memories of *any*
> status and sensitivity, including secrets, and it has no auth — it's meant for
> one person on one machine. Note that `fastapi run` defaults to `--host 0.0.0.0`,
> which would publish it to your whole network, so always pass `--host 127.0.0.1`
> (`fastapi dev` already binds to localhost).

## Your data

Worth knowing, especially if any of this is work-related:

- **The database is plain SQLite — no encryption.** Everything is readable in the
  file, including memories marked `secret`/`sensitive` and their full-text index
  entries. The sensitivity levels control what the *read tools return*; they are
  not storage protection. Anyone with the file has everything, backups included.
- **Lock down the file.** It's created world-readable by default, which matters on
  a shared or managed machine:
  ```bash
  chmod 600 memory.db
  ```
- **Rejecting is not deleting.** `rejected` and `superseded` are status changes —
  the text stays, on purpose, for history. To actually remove content there's a
  **Delete permanently** button on the detail page (`DELETE /memories/{id}`),
  which drops the row and its search-index entry. It's deliberately not available
  over MCP: deleting is your call, not an assistant's.
- **The API trusts its network position, not its callers.** No auth, bound to
  localhost, `Host` header pinned to `127.0.0.1`/`localhost` so a hostile page
  can't reach it via DNS rebinding.

## Multiple stores

`PERSONAL_MEM_DB` overrides which database is used. Handy for keeping a work
machine's store separate from your personal one, or for demoing:

```bash
# macOS/Linux
PERSONAL_MEM_DB=/Users/you/personal-memory/work.db uv run fastapi run api/app.py --host 127.0.0.1

# Windows (PowerShell)
$env:PERSONAL_MEM_DB = "C:\path\to\work.db"; uv run fastapi run api/app.py --host 127.0.0.1
```

Without it, the path defaults to the database next to `personal_mem_store.py`.

## Tests

```bash
uv run python personal_mem_test.py      # runs on throwaway copies, never your real DB
```

## Regenerating the frontend types

The TypeScript types are generated from the API schema, so the Pydantic models
stay the single source of truth:

```bash
uv run python -c "import json, api.app as a; json.dump(a.app.openapi(), open('frontend/openapi.json','w'), indent=2)"
cd frontend && npm run gen:api
```

## Layout

| Path | What |
|---|---|
| `personal_mem_store.py` | domain layer — all the logic, no transport imports |
| `personal_mem_mcp.py` | MCP server (5 tools) |
| `api/app.py` | FastAPI JSON API + serves the built frontend |
| `frontend/` | React + Vite SPA |
| `memory_init.py` | schema setup · `seed_demo.py` — demo data |
| `docs/decisions/` | ADRs — start with ADR-001 (the approval flow) |
