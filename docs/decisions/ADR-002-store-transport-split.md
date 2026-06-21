# ADR-002: Store / transport split

**Status:** accepted
**Date:** 2026-06-19

## Context

The MCP server held all SQL and business logic inside its `@mcp.tool` functions.
A second consumer is planned (a local web UI), and duplicating the logic would
cause drift.

## Decision

Split into a transport-agnostic **domain layer** and thin **transports**:

- `personal_mem_store.py` — all SQLite logic, the Pydantic models
  (`MemoryInput`, `Decision`, `MemoryFilter`), the `Sensitivity` type alias, the
  `_session` connection context manager, and a domain exception `StoreError`.
  **It must not import `fastmcp` or any transport library.**
- `personal_mem_mcp.py` — thin FastMCP wrappers. Each tool calls a store function,
  owns the LLM-facing docstrings/governance rules, applies the read sensitivity
  policy, and translates `StoreError` → `ToolError`.

Error chain: low-level `sqlite3.Error` → `StoreError` (inside `_session`) →
`ToolError` (in the MCP wrappers). The store never leaks raw DB errors.

The same Pydantic models will be reused by the future web UI backend (request
bodies) — one definition, three uses (MCP schema, HTTP body, store input).

## Alternatives Considered

- **Logic in the MCP tools**: rejected — not reusable by the web UI.
- **MCP tools catch `sqlite3.Error` directly**: rejected — pulls a DB detail into
  the transport; converting at the `_session` boundary keeps transports clean.

## Consequences

- The web UI imports the same store with zero logic duplication.
- Adding a tool = a thin wrapper + a store function.
- `StoreError` is the single error type transports translate.
