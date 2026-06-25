# ADR-004: Web UI = React + Vite frontend over a FastAPI JSON API

**Status:** accepted
**Date:** 2026-06-25

## Context

The web UI was originally planned as FastAPI + htmx (server-rendered). The owner
prefers building it in **React + Vite** (their own stack), which allows a richer
UI later (e.g. supersede-chain visualization). A React SPA runs in the browser
and cannot import the Python store directly — so a backend HTTP API is still
required.

## Decision

- **Backend:** a thin **FastAPI JSON API** (`api/app.py`) over the same
  `personal_mem_store`. It is the *second* transport (after the MCP server),
  reaffirming [ADR-002](ADR-002-store-transport-split.md): it imports the store
  and translates `StoreError` → **HTTP 400** (global exception handler).
- **Frontend:** a **React + TypeScript + Vite** SPA in `frontend/` (same repo /
  monorepo). Dev uses two processes; Vite's dev server proxies API calls to the
  backend (`/memories` → `http://127.0.0.1:8000`) to avoid CORS. Linter: ESLint.
- **Admin surface, localhost only.** Unlike the MCP read tools, this API returns
  rows of ANY status and sensitivity (incl. `sensitive`/`secret`). It must stay
  bound to `127.0.0.1` and is never exposed; `list_memories` lives here, never on MCP.
- The shared Pydantic models (`MemoryInput`, `Decision`, `MemoryFilter`) double as
  FastAPI request bodies → automatic OpenAPI docs at `/docs`.

## Alternatives Considered

- **FastAPI + htmx** (server-rendered): rejected — owner prefers React and wants
  room for a richer UI.
- **Separate frontend repo**: rejected for the backend — it must import the store,
  so it stays in this repo. Only the React app lives in `frontend/`.

## Consequences

- Two dev processes (`fastapi dev api/app.py` + `npm run dev`).
- FastAPI **route ordering** matters: static paths (e.g. `/memories/facets`) must
  be declared before the parameterized `/memories/{id}` or the int converter
  shadows them (caused a 422 once — now fixed).
- Complex reads use **POST with a `MemoryFilter` body** (`POST /memories/search`),
  not GET — the nested filter doesn't map cleanly to query params.
- Open: whether to prefix all routes with `/api` (one proxy entry, cleaner URLs).
