# Conventions

## Language

- Code, comments, docstrings, and these docs: **English**.
- **Stored memory content** (`title`, `body`, `tags`) is also written in
  **English**, regardless of the conversation language, so FTS retrieval stays
  consistent. The tool descriptions instruct the model accordingly.
- (Chat with the owner may be in German, but the codebase stays English and
  contains no personal data.)

## Code Style

- Python `>=3.14`. Modern typing: built-in generics (`list[int]`), `X | None`.
- stdlib `sqlite3`; Pydantic v2 models for all structured inputs.
- Config in `pyproject.toml`; dependencies managed with **uv** (`uv.lock`).

## Layering rules (most important)

- `personal_mem_store.py` is the **domain layer**: SQL, models, `StoreError`.
  It **must not import `fastmcp`**, `fastapi`, or any transport library.
- Two **thin transports** call the store and translate `StoreError` outward; no SQL:
  - `personal_mem_mcp.py` (MCP) → `ToolError`; holds the LLM docstrings/governance.
  - `api/app.py` (FastAPI JSON) → HTTP 400 (global exception handler).
- Error chain is always `sqlite3.Error` → `StoreError` → `ToolError` / HTTP 400.
- New behavior = a **store function** + a thin wrapper in each transport that needs it.

## SQL safety (when building queries)

- **Bind all values** as parameters (`?`). Never f-string a value into SQL.
- **Identifiers and operators come from allowlists**, then are inlined:
  - column names → `Literal` keys / fixed sets (e.g. `MemoryFilter.choices`,
    `order_by`, `_UPDATABLE`)
  - timestamp operators → `_TIMESTAMP_OPS`
- Guard empty `IN ()` (skip empty value lists).
- All writes go through `_session(write=True)` (auto commit/rollback/close).

## Naming

- Functions/variables: `snake_case`. Store ops use a `_mem` suffix
  (`search_mem`, `suggest_mem`, `review_mem`, `update_mem`, `list_memories`).
- Classes/Pydantic models: `PascalCase` (`MemoryInput`, `Decision`, `MemoryFilter`).
- Module-level constants: `UPPER_SNAKE` (`_UPDATABLE`, `_TIMESTAMP_OPS`); leading
  underscore for private helpers (`_session`, `_row_to_dict`).
- Files: `snake_case.py`.

## Tool docstrings (MCP)

- The docstrings ARE the model's instructions — keep the governance rules in them
  (suggest-only, ask before approving, never self-approve, secret behavior).
- Pydantic field docs use `Field(description=...)` so they reach the model's schema
  (inline `#` comments do NOT).

## Key Commands

```bash
# Run the test suite (22 tests, on throwaway DB copies)
uv run python personal_mem_test.py
uv run python -m pytest personal_mem_test.py

# (Re)create the schema
uv run python memory_init.py

# Seed anonymous demo memories into the active DB (idempotent)
uv run python -c "import personal_mem_test as t; print(len(t.seed_into_db()))"

# Run the web API (FastAPI, localhost; docs at /docs)
uv run fastapi dev api/app.py

# Always-on: serve the built SPA from the API itself (see deploy/)
uv run fastapi run api/app.py --host 127.0.0.1

# Frontend (React + Vite), from frontend/
cd frontend && npm run dev          # dev server on :5173, proxies /memories → :8000

# Inspect / register the MCP server
uv run fastmcp dev inspector personal_mem_mcp.py    # browser UI (needs Node)
claude mcp list                                                 # 'personal-mem' is registered
```

> Note: `python` is not on PATH. `uv run python` works on every OS; the direct
> paths are `uv run python` (Windows) and `.venv/bin/python`
> (macOS/Linux). On this machine the Bash tool is Git Bash (POSIX), and
> PowerShell is the primary shell.

## Gotchas

- **FastAPI route ordering:** declare static paths (`/memories/facets`) BEFORE the
  parameterized `/memories/{id:int}`, or the int converter shadows them (→ 422).
- **Complex reads use POST + body**, not GET — a nested `MemoryFilter` doesn't map
  cleanly to query params (`POST /memories/search`).
- Pagination is currently **disabled** in `list_memories` (`limit`/`offset` commented
  out on `MemoryFilter`) — it returns all matches. Re-enable when the store grows.

## AI Agent Conventions

- Add memory operations as a **store function + a thin wrapper** in each transport
  (MCP and/or API), never inline SQL in a transport file.
- **Consolidate, don't fragment:** one memory per specific topic. Search before
  creating; if the topic exists, supersede it to fold in new detail; new memories
  only for a genuinely new topic or to split a multi-topic one. (Encoded in the
  `suggest_memories` docstring + ADR-001.)
- Do **not** change the approval flow ([ADR-001](decisions/ADR-001-approval-flow.md)) — it is locked
  (approve/reject/edit are all human-gated).
- Do **not** expose `list_memories`/`get_one_mem`/`facets`/`purge_mem` (any all-status or
  all-sensitivity read) via MCP — those are the localhost web-API only.
- Run `personal_mem_test.py` (17 tests) before considering a change done.
- Keep the codebase free of personal data; seeds stay anonymous.
