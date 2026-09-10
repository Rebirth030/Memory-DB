"""Personal memory web API — local admin/review backend.

A thin FastAPI JSON layer over ``personal_mem_store`` for the (React/Vite) web
UI. Unlike the MCP server, this surface is for the human owner: it can read and
return memories of ANY status and sensitivity (including ``sensitive``/
``secret``). Therefore it MUST stay bound to localhost only — never expose it.

Errors: any ``StoreError`` raised by the store is translated to HTTP 400 by the
global handler below (mirroring how the MCP server maps it to ``ToolError``).

Run: ``fastapi dev api/app.py``  (serves on http://127.0.0.1:8000, docs at /docs)

Route note: static paths (e.g. ``/memories/facets``) are declared BEFORE the
parameterized ``/memories/{id}`` so they are not shadowed by the int converter.
"""

from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
# StaticFiles raises Starlette's HTTPException, not FastAPI's subclass of it.
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse, Response

import personal_mem_store as store

app = FastAPI(
    title="Personal Memory API",
    description="Local admin/review backend over the personal memory store.",
    version="0.1.0",
)

# This service has no auth and returns secrets, so it relies entirely on being
# unreachable from outside. Pinning the Host header closes the DNS-rebinding gap:
# a malicious page can point its own hostname at 127.0.0.1, but the browser still
# sends *its* hostname here, and we reject it.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])


@app.exception_handler(store.StoreError)
async def store_error_handler(request: Request, exc: store.StoreError) -> JSONResponse:
    """Translate a domain-level StoreError into a clean HTTP 400 response."""
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.post("/memories/search", response_model=list[store.Memory])
def search_memories(mem_filter: store.MemoryFilter) -> list[dict[str, Any]]:
    """Filter, search and sort memories (any status/sensitivity).

    Body is a ``MemoryFilter``; an empty ``{}`` returns everything with the
    default ordering. This is the admin read path — do not expose publicly.
    """
    return store.list_memories(mem_filter)


@app.post("/memories/commit", response_model=store.Memory)
def commit_memory(memory: store.MemoryInput) -> dict[str, Any]:
    """Create a single memory directly as 'active' (no review step)."""
    return store.commit_active(memory)


@app.post("/memories/review", response_model=list[store.Memory])
def review_memories(decisions: list[store.Decision]) -> list[dict[str, Any]]:
    """Approve or reject candidates; approving a `supersedes` candidate swaps atomically."""
    return store.review_mem(decisions)


@app.get("/memories/facets", response_model=store.Facets)
def get_facets() -> dict[str, list[str]]:
    """Filter options for the UI: status/sensitivity (from schema) + distinct category/type/source."""
    return store.facets()


@app.get("/memories/{id}", response_model=store.Memory)
def get_memory(id: int) -> dict[str, Any]:
    """Fetch one memory by id, in ANY status/sensitivity. Missing id -> 400."""
    return store.get_one_mem(id)


@app.patch("/memories/{id}", response_model=store.Memory)
def update_memory(id: int, patch: store.MemoryUpdate) -> dict[str, Any]:
    """Edit fields of one memory in place — partial, only the fields sent apply.

    A missing id raises a StoreError -> 400. Setting `supersedes` on an active
    memory retires the old target (the store performs the swap).
    """
    return store.update_mem(id, patch.model_dump(exclude_unset=True))


@app.delete("/memories/{id}", response_model=store.PurgeResult)
def purge_memory(id: int) -> dict[str, Any]:
    """Permanently delete one memory — row and search index.

    Rejecting or superseding only changes a status; the text stays. This is the
    only way to actually remove content, e.g. when something was captured that
    shouldn't have been. Not reachable over MCP — deleting is the human's call.
    """
    return store.purge_mem(id)


# --------------------------------------------------------------------------- #
# Built frontend (production / always-on mode)
# --------------------------------------------------------------------------- #
# In development the SPA runs on Vite's own server (:5173) and proxies /memories
# here, so this block does nothing. Once `npm run build` has produced
# frontend/dist, we serve it from this same process — one port, no proxy, which
# is what the launchd/systemd unit runs. Mounted LAST so it never shadows the
# API routes above.

_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


class _SPAFiles(StaticFiles):
    """Static files with a single-page-app fallback.

    React Router owns paths like /browse and /memory/45. On a hard refresh the
    browser asks the server for them, and there is no such file — so fall back to
    index.html and let the client router sort it out.
    """

    async def get_response(self, path: str, scope: Any) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


if _DIST.is_dir():
    app.mount("/", _SPAFiles(directory=_DIST, html=True), name="spa")
