# Current Goals

## Active Goals

- Build the **React + Vite frontend** (`frontend/`) over the now-complete FastAPI
  JSON API: a candidate **review queue** (approve/reject), a **browse/search/filter**
  view, and **edit**. Localhost only (see [ADR-004](decisions/ADR-004-react-vite-frontend.md)).

## In Progress

- Scaffolding `frontend/` (`npm create vite@latest frontend -- --template react-ts`,
  ESLint) and wiring the **Vite dev proxy** (`/memories` → `http://127.0.0.1:8000`).

## Next Steps

- Frontend: a small API client (`src/api.ts`), then the browse page (`POST
  /memories/search` → table + filters from `GET /memories/facets`), then the
  review queue and an edit form.
- Decide whether to prefix all API routes with **`/api`** (one proxy entry,
  cleaner URLs) vs. the current `/memories/...`.

## Open Questions

- Web UI auth: localhost-only, no login, is assumed sufficient for the MVP.
- `PATCH /memories/{id}` takes a raw dict — add a typed `MemoryUpdate` model for
  better `/docs` + value validation? And a `NotFoundError(StoreError)` → 404?
- CORS: rely on the Vite proxy (preferred) or add `CORSMiddleware` for `:5173`?

## Backlog / Deferred

- Pagination: `limit`/`offset` were removed from `MemoryFilter`/`list_memories`
  (small store). Re-add with a `count_mem(filter)` when the store grows.
- pytest-proper structure (current suite is assert-based, runs with or without pytest).
- Embeddings / `sqlite-vec` / graph layer — explicitly out of MVP scope.
- Markdown export (superseded by the web UI as review surface).
- Full ChatGPT/GPT integration (ChatGPT only connects to *remote* HTTPS MCP, not
  local stdio — Codex CLI is the local-stdio path if ever wanted).

## Done (recent)

- MCP server feature-complete and registered with Claude Code (`personal-mem`, ✔ Connected).
- Store gaps for the UI built: `get_one_mem`, `commit_active`, `distinct_values`, `facets`.
- FastAPI JSON API (`api/app.py`): all 7 endpoints + global `StoreError`→400 handler.
- DB cleaned up: categories normalized (+ `background`), fragments consolidated via
  supersede, work/projects split; real memories translated to English.
- Search `auto-OR` fallback; `.gitignore` (DB, backups, `node_modules`).
