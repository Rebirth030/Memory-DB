# Current Goals

## Active Goals

- Build a **local web UI** (FastAPI + htmx, 127.0.0.1 only) as the admin/review
  surface: a candidate review queue (approve/reject) and a browse/search/filter
  view over all memories — reusing the existing store layer.

## In Progress

- (Nothing mid-edit.) The MCP side is feature-complete for the MVP and the server
  is registered with Claude Code (`personal-mem`, user scope, ✔ Connected).

## Next Steps

- **Web UI backend (FastAPI):** thin endpoints over the store —
  `list_memories` (already built), `review_mem`, `update_mem`, plus a manual
  active-write path. The backend may show `sensitive`/`secret`; bind to localhost only.
- **Web UI frontend (htmx + Jinja2):** review queue + browse/filter pages.
- Decide whether the chat flow needs a direct "commit active after the user's yes"
  store op (`commit_active`) or stays on suggest→approve. (Owner leaned toward
  writing only after confirmation; the swap logic already exists in `review_mem`.)
- Seed the real `memory.db` (currently empty) when convenient — anonymous demo
  seeds available via `personal_mem_test.seed_into_db()`.

## Open Questions

- Web UI auth: localhost-only is assumed sufficient for the MVP (no login). Confirm.
- Pagination: add a `count_mem(filter)` companion to `list_memories` for "page N of M"?

## Backlog / Deferred

- Markdown export of active memories (superseded by the web UI as review surface).
- Embeddings / `sqlite-vec` / graph layer — explicitly out of MVP scope.
- pytest-proper structure (current suite is assert-based, runs with or without pytest).
- Full ChatGPT/GPT integration; automatic chat capture.
