# Architecture Decision Records

Each significant technical decision gets its own file here.

**When to create an ADR:**
- A tool or library is permanently adopted
- An architectural boundary is defined
- A technical approach is consciously chosen over alternatives
- A previous decision is reversed or superseded

**Naming convention:** `ADR-NNN-short-title.md`

**Status values:** `accepted` | `superseded` | `deprecated` | `proposed`

## Index

- [ADR-001](ADR-001-approval-flow.md) — Memory lifecycle & human-in-the-loop approval flow (**LOCKED**)
- [ADR-002](ADR-002-store-transport-split.md) — Store / transport split
- [ADR-003](ADR-003-secrets-write-not-read.md) — Secrets: writable by the model, never readable
