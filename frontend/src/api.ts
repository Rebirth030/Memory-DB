// Typed client for the local FastAPI backend. All paths are relative; the Vite
// dev server proxies `/memories` -> http://127.0.0.1:8000 (see vite.config.ts).
//
// Usage: const rows = await searchMemories({ choices: { status: ["candidate"] } });

import type { Decision, Facets, Memory, MemoryFilter, MemoryInput, MemoryUpdate } from "./types";

/** One fetch wrapper: sets the JSON header, throws on non-2xx, parses the body. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...init,
    });
    if (!res.ok) {
        // the backend returns { detail: "..." } for StoreError -> 400 / 422
        let detail = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            if (data && typeof data.detail === "string") detail = data.detail;
        } catch {
            // non-JSON error body — keep the status message
        }
        throw new Error(detail);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
}

/** POST /memories/search — filter/sort over ALL statuses & sensitivities. */
export const searchMemories = (filter: MemoryFilter = {}) =>
    request<Memory[]>("/memories/search", { method: "POST", body: JSON.stringify(filter) });

/** GET /memories/:id — one memory, any status/sensitivity. */
export const getMemory = (id: number) => request<Memory>(`/memories/${id}`);

/** GET /memories/facets — filter dropdown options. */
export const getFacets = () => request<Facets>("/memories/facets");

/** POST /memories/commit — create one memory directly active. */
export const commitMemory = (body: MemoryInput) =>
    request<Memory>("/memories/commit", { method: "POST", body: JSON.stringify(body) });

/** POST /memories/review — approve/reject candidates. */
export const reviewMemory = (decisions: Decision[]) =>
    request<Memory[]>("/memories/review", { method: "POST", body: JSON.stringify(decisions) });

/** PATCH /memories/:id — edit content fields of one memory. */
export const updateMemory = (id: number, body: MemoryUpdate) =>
    request<Memory>(`/memories/${id}`, { method: "PATCH", body: JSON.stringify(body) });
