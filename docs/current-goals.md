# Current Goals

## Active Goals

- Build & polish the **React + Vite frontend** (`frontend/`) over the FastAPI JSON
  API: candidate **review queue** (approve/reject), **browse/search/filter**, and
  **edit**. Localhost only ([ADR-004](decisions/ADR-004-react-vite-frontend.md)).

## In Progress

- `frontend/` is scaffolded (React + TS + Vite, ESLint). Home, Review and
  Detail/Edit pages exist with demo data; next is wiring them to the API.

## Next Steps (prioritized)

1. **Finish the React/TS frontend**: a small API client (`src/api.ts`), the
   browse/search page (filters from `GET /memories/facets`), then replace the
   demo data in Home/Review/Detail with real fetches.
2. **Vite dev proxy** (`/memories` → `http://127.0.0.1:8000`) so the SPA talks to
   the API without CORS.
3. **`README.md`** — what the project is, how to run both processes, links to the ADRs.
4. **Docker** — Dockerfile for the API + `docker-compose` for a one-command local run.
5. **TS types from OpenAPI** — generate a typed client from FastAPI's `/openapi.json`
   (`openapi-typescript`) instead of the hand-written `src/types.ts`.
6. Decide `/api` route prefix vs. the current `/memories/...`.

## Open Questions

- Web UI auth: localhost-only, no login, is assumed sufficient for the MVP.
- `PATCH /memories/{id}` takes a raw dict — add a typed `MemoryUpdate` model for
  better `/docs` + value validation? And a `NotFoundError(StoreError)` → 404?
- CORS: rely on the Vite proxy (preferred) or add `CORSMiddleware` for `:5173`?
- Clearing `supersedes`/`valid_to` to NULL via `update_mem` (None values are
  currently filtered out) — needed, or leave it?

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
- Store reads/writes for the UI: `get_one_mem`, `commit_active`, `distinct_values`,
  `facets`; `update_mem` performs the supersede swap on active memories.
- FastAPI JSON API (`api/app.py`): all 7 endpoints + global `StoreError`→400 handler.
- DB cleaned up: categories normalized (+ `background`), fragments consolidated via
  supersede, work/projects split; real memories translated to English.
- Frontend pages (Home, Review, Detail/Edit) built with demo data; 20-test store suite.
