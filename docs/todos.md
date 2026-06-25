# ToDos

<!-- Tags: #webui #api #store #mcp #test #docs #infra -->

## Active

- [ ] Scaffold React + Vite frontend in `frontend/` (react-ts, ESLint) #webui
- [ ] Vite dev proxy `/memories` → `http://127.0.0.1:8000` #webui
- [ ] Frontend API client (`src/api.ts`) + browse/search page using facets #webui
- [ ] Frontend candidate review queue (approve/reject) + edit form #webui
- [ ] Decide: prefix API routes with `/api` vs current `/memories/...` #api

## Backlog

- [ ] Typed `MemoryUpdate` model for `PATCH` (better /docs + value validation) #api #store
- [ ] `NotFoundError(StoreError)` → HTTP 404 for missing ids #api #store
- [ ] CORS decision: Vite proxy (preferred) vs `CORSMiddleware` for `:5173` #api
- [ ] Re-add pagination (`limit`/`offset` + `count_mem`) when the store grows #store #webui
- [ ] Move the assert-based suite to proper pytest structure #test
- [ ] Optional Markdown export (low priority) #webui

## Done

<!-- keep ~2 weeks -->
- [x] Store/MCP split (ADR-002); secrets writable-not-readable (ADR-003) #store
- [x] Locked approval flow incl. supersede-at-approval + edit-gating (ADR-001) #mcp
- [x] Consolidation rule (one memory per topic; supersede to enrich) in docstrings/CLAUDE/AGENTS #mcp #docs
- [x] Store gaps for UI: `get_one_mem`, `commit_active`, `distinct_values`, `facets` #store
- [x] Shared `_insert_memories` helper (suggest/commit dedup); `Sensitivity` alias #store
- [x] FastAPI JSON API (`api/app.py`) — 7 endpoints + `StoreError`→400 handler (ADR-004) #api
- [x] Fixed FastAPI route-ordering bug (static `/facets` before `/{id}`) #api
- [x] Search `auto-OR` fallback for naive multi-word queries #store
- [x] DB cleanup: categories normalized (+ `background`), fragments consolidated, work/projects split #infra
- [x] Real memories translated to English; English-content convention #infra #docs
- [x] 17-test suite (added get_one/commit/distinct/facets tests) #test
- [x] `.gitignore` (DB + backups + node_modules; keep `__init__.py`) #infra
- [x] Register MCP server with Claude Code (`personal-mem`, connected) #infra
