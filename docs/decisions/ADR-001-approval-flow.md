# ADR-001: Memory lifecycle & human-in-the-loop approval flow

**Status:** accepted (LOCKED — do not revisit without explicit owner request)
**Date:** 2026-06-19

## Context

An AI assistant can write to the memory store, but the store is meant to be a
*controlled* source of truth about the user. Unreviewed automatic writes would
let the model pollute long-term memory. We needed a flow where the model can
propose, but a human always decides what becomes real.

## Decision

The `status` column drives a fixed lifecycle:

```
candidate ──approve──▶ active ──(superseded by a newer memory)──▶ superseded
    └────────reject────────▶ rejected
```

Rules — **final, must not be changed**:

1. **The model only suggests.** `suggest_memories` writes rows as `status='candidate'`.
   Candidates are indexed but **never** returned by the read tools (`search_memories`,
   `get_memories`), which only return `active`.
2. **The human approves/rejects/edits.** Only `approve_reject_memories` flips a
   candidate to `active`/`rejected`. The model **must ask the user** and act on
   their explicit decision — it must **never** approve its own suggestions on its
   own initiative. Editing a live memory (`update_memory`) changes active data
   directly with no candidate review, so it is **equally gated**: the model must
   ask the user first and never edit on its own.
3. **Supersede happens via the candidate path at approval time.** To replace an
   existing memory, a candidate carries `supersedes=<old_id>`. The swap (old →
   `superseded` with `valid_to`; new → `active` with `valid_from`, same timestamp)
   runs **atomically when the candidate is approved**, not when it is suggested.
   The supersede target must still be `active` at approval time, else the batch
   is rejected.

## Alternatives Considered

- **Direct active writes by the model**: rejected — removes the review gate.
- **Standalone immediate `supersede` tool**: rejected — bypasses the candidate
  review; the swap is folded into approval instead.
- **Two MCP servers (read+suggest vs admin)**: deferred — one server with the
  approve-in-chat rule is enough; the planned web UI becomes the richer review surface.

## Consequences

- Retrieval can never surface unreviewed or replaced data.
- `approve_reject_memories` carries the supersede swap logic (one transaction,
  all-or-nothing).
- Reject is a no-op on live data (the old memory is untouched until approval).
- The model's tool docstrings encode the "ask first, never self-approve" rule.
