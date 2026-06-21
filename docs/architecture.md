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
| Schema init | Creates `memories` table, `memories_fts` (FTS5), and the sync triggers. | `memory_init.py` |
| Tests + seeds | Anonymous sample seeds + 14-test suite on throwaway DB copies. | `personal_mem_test.py` |
| Web UI (planned) | Local FastAPI + htmx admin/review surface; reuses the store. | _not built yet_ |

## Data Flow

```
Assistant ─(MCP/stdio)→ personal_mem_mcp.py ─→ personal_mem_store.py ─→ memory.db (+ FTS5)
                                                         ▲
Web UI (planned, FastAPI+htmx) ──────────────────────────┘  (same store layer)
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
| Package manager | uv | `.venv/`, `uv.lock` |
| Web UI (planned) | FastAPI + htmx | server-rendered, local only (127.0.0.1) |

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

## Important Files / Entry Points

| File | Purpose |
|---|---|
| `personal_mem_mcp.py` | MCP entry point (`python personal_mem_mcp.py` → stdio) |
| `personal_mem_store.py` | Domain layer (library, no `main`) |
| `memory_init.py` | One-off schema setup (`python memory_init.py`) |
| `personal_mem_test.py` | Seeds + tests (`python personal_mem_test.py` or pytest) |
| `memory.db` | The SQLite store (source of truth) |
