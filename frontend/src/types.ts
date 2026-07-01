// Shared types for the memory store.
//
// The DATA SHAPES are re-exported from the generated OpenAPI types
// (`src/api-types.ts`, regenerate with `npm run gen:api`) — the backend Pydantic
// models are the single source of truth, so these never drift. Only the
// UI-specific constants/helpers below are hand-written.

import type { components } from "./api-types";

type Schemas = components["schemas"];

// --- data shapes (generated) ---
export type Memory = Schemas["Memory"];
export type MemoryInput = Schemas["MemoryInput"];
export type MemoryUpdate = Schemas["MemoryUpdate"];
export type Decision = Schemas["Decision"];
export type MemoryFilter = Schemas["MemoryFilter"];
export type Facets = Schemas["Facets"];

// convenience aliases derived from the generated types
export type Sensitivity = Memory["sensitivity"];
export type Status = Memory["status"];
export type FacetKey = keyof Facets;
export type OrderBy = MemoryFilter["order_by"];

// --------------------------------------------------------------------------- //
// UI-only (not part of the API) — hand-written
// --------------------------------------------------------------------------- //

// Fields editable on the detail page — match the store's _UPDATABLE allowlist.
// Setting `supersedes` on an active memory retires the old target server-side
// (update_mem performs the swap). status / id / source / timestamps stay
// read-only — status changes via review.
export type EditableField =
    | "title" | "body" | "type" | "category" | "tags"
    | "confidence" | "sensitivity" | "valid_from" | "valid_to" | "supersedes";

// Option lists for the selects. category/type/source can also come from GET
// /memories/facets at runtime; these are the static fallbacks.
export const SENSITIVITIES: Sensitivity[] = ["public", "normal", "private", "sensitive", "secret"];
export const TYPES: string[] = ["preference", "fact", "goal", "project", "environment", "note"];
export const CATEGORIES: string[] = [
    "identity", "communication", "preferences", "work", "education", "projects",
    "tech_stack", "hardware", "tools", "goals", "constraints", "background", "general",
];

// status -> [foreground var, background var]
export const STATUS_VARS: Record<Status, [string, string]> = {
    candidate: ["--cand", "--cand-bg"],
    active: ["--active", "--active-bg"],
    superseded: ["--super", "--super-bg"],
    rejected: ["--reject", "--reject-bg"],
};

export function statusStyle(s: Status) {
    const [fg, bg] = STATUS_VARS[s];
    return { color: `var(${fg})`, background: `var(${bg})`, borderColor: `var(${fg})` };
}
