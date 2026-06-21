# ADR-003: Secrets are writable by the model, never readable by it

**Status:** accepted
**Date:** 2026-06-19

## Context

The original concept said "never store secrets". The owner changed this: the
model should be able to *record* sensitive items, but must never be able to
*read them back*. Secrets are reviewed only in the (planned) web UI.

## Decision

- `sensitivity` is one of `public | normal | private | sensitive | secret`
  (enforced as a `Literal` at the Pydantic boundary).
- **Write:** the model may store a memory at any sensitivity, including
  `sensitive`/`secret`.
- **Read:** the MCP read tools (`search_memories`, `get_memories`) only ever
  return `public | normal | private`. `sensitive` and `secret` are excluded by
  the store's SQL.
- **The web UI / `list_memories` admin path returns everything**, including
  `sensitive`/`secret`. Therefore `list_memories` must **never** be exposed as
  an MCP tool.

## Alternatives Considered

- **Forbid storing secrets entirely**: rejected by owner — wants to capture them.
- **Filter sensitivity only in the transport**: rejected — the filter lives in
  the store reads so both tools share it; the *policy choice* (which levels to
  show) is per-caller.

## Consequences

- A credential can be saved as `sensitivity='secret'` and is then invisible to
  the model forever via MCP.
- `list_memories` is admin/web-UI only — exposing it via MCP would leak secrets.
- Input validation of `sensitivity` (and `confidence` ∈ [0,1]) happens once, at
  the Pydantic boundary, for every transport.
