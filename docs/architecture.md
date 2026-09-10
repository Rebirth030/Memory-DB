# Architecture

## Overview

A local, controllable long-term memory store for AI assistants (Claude, Codex,
later others). SQLite (`memory.db`) is the single source of truth; FTS5 provides
fast local full-text search. A transport-agnostic domain layer holds all logic;
a thin MCP server exposes it to assistants. The model can *propose* memories but
a human *approves* them (see [ADR-001](decisions/ADR-001-approval-flow.md)).

The goal is NOT to host a model — only to give assistants a persistent, private,
token-efficient memory they can query on demand instead of being re-told context.

## Main Components

| Component | Responsibility | Key files |
|---|---|---|
| Domain layer / store | All SQLite logic, Pydantic models, `StoreError`, `_session`. No transport deps. | `personal_mem_store.py` |
| MCP server | Thin FastMCP wrappers; LLM docstrings/governance; `StoreError`→`ToolError`. | `personal_mem_mcp.py` |
| Web API (transport 2) | Thin FastAPI JSON layer; `StoreError`→HTTP 400; localhost admin. | `api/app.py` |
| Web UI | React + TypeScript + Vite SPA; calls the API; localhost only. | `frontend/` |
| Schema init | Creates `memories` table, `memories_fts` (FTS5), and the sync triggers. | `memory_init.py` |
| Tests + seeds | Anonymous sample seeds + 17-test suite on throwaway DB copies. | `personal_mem_test.py` |

## Data Flow

```
Assistant ──(MCP/stdio)────→ personal_mem_mcp.py ─┐
                                                  ├─→ personal_mem_store.py ─→ memory.db (+ FTS5)
React SPA ──(HTTP/JSON)──→ api/app.py (FastAPI) ──┘   (same store layer, two thin transports)
   (frontend/, via Vite dev proxy /memories → :8000)
```

- **Reads** (`search_memories`, `get_memories`): active-only, exclude `sensitive`/`secret`.
- **Writes** by the model: `suggest_memories` → `candidate` only.
- **Review**: `approve_reject_memories` (human-triggered) flips candidates and runs
  the supersede swap atomically.
- FTS5 is an external-content index kept in sync by triggers on `memories`.

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Language | Python | `requires-python >=3.14` |
| Storage | SQLite + FTS5 | stdlib `sqlite3`; `tokenize='unicode61'` (mixed DE/EN/tech terms) |
| Models/validation | Pydantic | `>=2.13.4` |
| MCP server | FastMCP | `>=3.4.2`, stdio transport |
| Web API | FastAPI | JSON over the store; `fastapi dev api/app.py`; localhost only |
| Web UI | React + TypeScript + Vite | `frontend/`; ESLint; Vite dev proxy → API ([ADR-004](decisions/ADR-004-react-vite-frontend.md)) |
| Package manager | uv (Python) · npm (frontend) | `.venv/`, `uv.lock`; `frontend/node_modules` |

## Key Constraints

- **Approval flow is locked** — see [ADR-001](decisions/ADR-001-approval-flow.md).
- **Secrets**: model may write any sensitivity; read tools never return
  `sensitive`/`secret` — those are web-UI only ([ADR-003](decisions/ADR-003-secrets-write-not-read.md)).
- **Store has no transport imports** ([ADR-002](decisions/ADR-002-store-transport-split.md)).
- `list_memories` returns ALL statuses/sensitivities → **never expose via MCP**.
- Local-only; no embeddings/vector DB/graph layer in the MVP.
- The project code contains **no personal data** — seeds are anonymous samples.

## Data Model (memories)

Columns: `id, type, category, title, body, tags, confidence, sensitivity,
status, source, valid_from, valid_to, supersedes, reason, created_at, updated_at`.
The text column is `body` (deliberately not `content`, to avoid clashing with the
FTS5 `content='memories'` option). FTS index: `memories_fts` over
`title, body, category, type, tags`.

## MCP Tools

| Tool | Kind | Notes |
|---|---|---|
| `search_memories(query, limit)` | read | FTS5; returns snippet + `body_truncated`; active, non-secret only |
| `get_memories(ids)` | read | full rows; active, non-secret only |
| `suggest_memories(items: list[MemoryInput])` | write | always `candidate`; the only autonomous model write |
| `update_memory(id, …content fields)` | write | in-place content edit; no status change |
| `approve_reject_memories(decisions: list[Decision])` | review | human-triggered; carries supersede swap |

## Web API endpoints (`api/app.py`, localhost only)

| Endpoint | Store fn | Notes |
|---|---|---|
| `POST /memories/search` | `list_memories(MemoryFilter)` | filter/search/sort; ANY status/sensitivity |
| `POST /memories/suggest` | `suggest_mem` | create candidates |
| `POST /memories/commit` | `commit_active` | create one memory directly active |
| `POST /memories/review` | `review_mem` | approve/reject (+ supersede swap) |
| `GET /memories/facets` | `facets` | filter options (declared **before** `{id}`) |
| `GET /memories/{id}` | `get_one_mem` | one memory, ANY status/sensitivity |
| `PATCH /memories/{id}` | `update_mem` | partial content edit |

Store also has admin-only reads the MCP must **not** expose: `list_memories`,
`get_one_mem`, `distinct_values`, `facets`; and a direct write `commit_active`.
`suggest_mem`/`commit_active` share the `_insert_memories` helper (only the
`status` differs). `Sensitivity` is the shared `Literal` for the privacy levels.

## Important Files / Entry Points

| File | Purpose |
|---|---|
| `personal_mem_mcp.py` | MCP entry point (`python personal_mem_mcp.py` → stdio) |
| `personal_mem_store.py` | Domain layer (library, no `main`) |
| `api/app.py` | FastAPI JSON API (`fastapi dev api/app.py` → :8000, docs at `/docs`) |
| `frontend/` | React + Vite SPA (`cd frontend && npm run dev` → :5173) |
| `memory_init.py` | One-off schema setup (`python memory_init.py`) |
| `personal_mem_test.py` | Seeds + tests (`python personal_mem_test.py` or pytest) |
| `memory.db` | The SQLite store (source of truth) |
