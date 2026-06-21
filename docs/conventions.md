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
  It **must not import `fastmcp`** or any transport library.
- `personal_mem_mcp.py` is a **thin transport**: tools call the store, hold the
  LLM docstrings, and translate `StoreError` → `ToolError`. No SQL here.
- Error chain is always `sqlite3.Error` → `StoreError` → `ToolError`.

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
# Run the test suite (14 tests, on throwaway DB copies)
.venv/Scripts/python.exe personal_mem_test.py
.venv/Scripts/python.exe -m pytest personal_mem_test.py

# (Re)create the schema
.venv/Scripts/python.exe memory_init.py

# Seed anonymous demo memories into the active DB (idempotent)
.venv/Scripts/python.exe -c "import personal_mem_test as t; print(len(t.seed_into_db()))"

# Inspect the MCP server (browser UI; needs Node/npx)
.venv/Scripts/fastmcp.exe dev inspector personal_mem_mcp.py
# Or no-UI:
.venv/Scripts/fastmcp.exe inspect personal_mem_mcp.py

# Register with Claude Code (already done as 'personal-mem', user scope)
claude mcp list
```

> Note: `python` is not on PATH — use `.venv/Scripts/python.exe`. The Bash tool
> here is Git Bash (POSIX), PowerShell is the primary shell.

## AI Agent Conventions

- Add memory operations as a **store function + thin MCP wrapper**, never inline SQL
  in the MCP file.
- Do **not** change the approval flow ([ADR-001](decisions/ADR-001-approval-flow.md)) — it is locked.
- Do **not** expose `list_memories` (or any all-status/all-sensitivity read) via MCP.
- Run `personal_mem_test.py` before considering a change done.
- Keep the codebase free of personal data; seeds stay anonymous.
