import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type FacetKey, type Memory, type Status, SENSITIVITIES, statusStyle } from "../types";
import { Lock, SearchIcon } from "../ui";
import { fmt } from "../format";

// --- demo data (replace with POST /memories/search) ---
const MEMORIES: Memory[] = [
    { id: 1, title: "Prefers concise, direct answers", body: "Wants replies kept short. Lead with the answer.", type: "preference", category: "communication", tags: "#tone", confidence: 0.95, sensitivity: "normal", source: "chat", status: "active", supersedes: null, reason: null, created_at: "2026-04-18 11:30", updated_at: "2026-04-18 11:30", valid_from: "2026-04-18 11:30", valid_to: null },
    { id: 3, title: "Ship Memory DB v1 by Q3", body: "Personal goal: usable v1 of the memory DB before end of Q3 2026.", type: "goal", category: "work", tags: "#roadmap", confidence: 0.8, sensitivity: "private", source: "chat", status: "active", supersedes: null, reason: null, created_at: "2026-02-11 08:05", updated_at: "2026-02-11 08:05", valid_from: "2026-02-11 08:05", valid_to: null },
    { id: 8, title: "Primary language is TypeScript", body: "Default to TypeScript for new code.", type: "fact", category: "tech_stack", tags: "#typescript", confidence: 1.0, sensitivity: "public", source: "chat", status: "active", supersedes: null, reason: null, created_at: "2026-01-15 14:00", updated_at: "2026-01-15 14:00", valid_from: "2026-01-15 14:00", valid_to: null },
    { id: 12, title: "Primary editor is VS Code", body: "Daily editor is VS Code with a Vim extension.", type: "preference", category: "tech_stack", tags: "#editor", confidence: 0.9, sensitivity: "public", source: "chat", status: "superseded", supersedes: null, reason: null, created_at: "2026-02-05 13:10", updated_at: "2026-06-24 14:02", valid_from: "2026-02-05 13:10", valid_to: "2026-06-24 14:02" },
    { id: 29, title: "Likes loud notification sounds", body: "Prefers loud audible notifications.", type: "preference", category: "general", tags: "#notifications", confidence: 0.6, sensitivity: "normal", source: "chat", status: "rejected", supersedes: null, reason: "Incorrect — keeps notifications silent.", created_at: "2026-03-30 16:44", updated_at: "2026-03-30 16:44", valid_from: "2026-03-30 16:44", valid_to: null },
    { id: 31, title: "Personal server SSH access note", body: "Bastion host, user 'core', id_personal key.", type: "fact", category: "general", tags: "#ssh", confidence: 1.0, sensitivity: "secret", source: "chat", status: "active", supersedes: null, reason: null, created_at: "2026-05-02 09:10", updated_at: "2026-05-02 09:10", valid_from: "2026-05-02 09:10", valid_to: null },
    { id: 45, title: "Primary editor is Neovim", body: "Switched to Neovim with LazyVim.", type: "preference", category: "tech_stack", tags: "#editor #neovim", confidence: 0.8, sensitivity: "normal", source: "chat", status: "candidate", supersedes: 12, reason: null, created_at: "2026-06-24 14:02", updated_at: "2026-06-24 14:02", valid_from: null, valid_to: null },
    { id: 48, title: "Allergic to penicillin", body: "Documented penicillin allergy.", type: "fact", category: "general", tags: "#health", confidence: 1.0, sensitivity: "sensitive", source: "chat", status: "candidate", supersedes: null, reason: null, created_at: "2026-06-22 08:30", updated_at: "2026-06-22 08:30", valid_from: null, valid_to: null },
];

const FACET_KEYS: FacetKey[] = ["status", "sensitivity", "category", "type", "source"];
const FACET_LABELS: Record<FacetKey, string> = { status: "Status", sensitivity: "Sensitivity", category: "Category", type: "Type", source: "Source" };
const STATUS_OPTS: Status[] = ["candidate", "active", "superseded", "rejected"];
const SORT_FIELDS: [keyof Memory, string][] = [
    ["updated_at", "Updated"], ["created_at", "Created"], ["title", "Title"],
    ["confidence", "Confidence"], ["type", "Type"], ["status", "Status"],
];

function distinct(col: keyof Memory): string[] {
    const seen = new Set<string>();
    MEMORIES.forEach((m) => seen.add(String(m[col])));
    return [...seen].sort();
}

type Filters = Record<FacetKey, string[]>;
const EMPTY: Filters = { status: [], sensitivity: [], category: [], type: [], source: [] };

function Browse() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<Filters>(EMPTY);
    const [sort, setSort] = useState<{ by: keyof Memory; desc: boolean }>({ by: "updated_at", desc: true });
    const [openFacet, setOpenFacet] = useState<string | null>(null);

    const facetData: Record<FacetKey, string[]> = {
        status: STATUS_OPTS, sensitivity: SENSITIVITIES,
        category: distinct("category"), type: distinct("type"), source: distinct("source"),
    };

    // filter + search
    const q = search.trim().toLowerCase();
    const filtered = MEMORIES.filter((m) => {
        for (const k of FACET_KEYS) {
            if (filters[k].length && !filters[k].includes(String(m[k]))) return false;
        }
        if (q && !`${m.title} ${m.body} ${m.tags}`.toLowerCase().includes(q)) return false;
        return true;
    });

    // sort
    const by = sort.by;
    const rows = [...filtered].sort((a, b) => {
        if (by === "confidence") return a.confidence - b.confidence;
        const x = String(a[by] ?? ""), y = String(b[by] ?? "");
        return x < y ? -1 : x > y ? 1 : 0;
    });
    if (sort.desc) rows.reverse();

    const toggleFacet = (k: string) => setOpenFacet((o) => (o === k ? null : k));
    const toggleFilter = (k: FacetKey, v: string) =>
        setFilters((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));
    const removeFilter = (k: FacetKey, v: string) =>
        setFilters((f) => ({ ...f, [k]: f[k].filter((x) => x !== v) }));
    const resetFilters = () => { setFilters(EMPTY); setSearch(""); setOpenFacet(null); };

    const chips = FACET_KEYS.flatMap((k) => filters[k].map((v) => ({ k, v })));
    const sortLabel = SORT_FIELDS.find(([f]) => f === sort.by)?.[1] ?? "";

    return (
        <div className="mx-auto max-w-310 px-5.5 pt-6.5 pb-20">
            {/* header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-[25px] font-semibold tracking-[-0.4px]">Library</h1>
                    <div className="mt-0.75 text-[13px] text-(--muted)">All memories — every status &amp; sensitivity, including secrets.</div>
                </div>
                <div className="font-mono text-[12px] text-(--muted)">{rows.length} / {MEMORIES.length} shown</div>
            </div>

            {/* search */}
            <div className="mt-4 flex items-center gap-2.5 rounded-[10px] border border-(--border) bg-(--surface) px-3.5 py-2.5">
                <SearchIcon />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, body & tags…"
                    className="flex-1 bg-transparent text-[14px] text-(--text) outline-none"
                />
                {search && <button onClick={() => setSearch("")} className="cursor-pointer text-[13px] text-(--muted)">clear ✕</button>}
            </div>

            {/* filter row */}
            <div className="mt-3.25 flex flex-wrap items-center gap-2.25">
                <span className="font-mono text-[11px] uppercase tracking-[0.5px] text-(--muted)">filter</span>
                {FACET_KEYS.map((k) => {
                    const cnt = filters[k].length;
                    const open = openFacet === k;
                    return (
                        <div key={k} className="relative">
                            <button
                                onClick={() => toggleFacet(k)}
                                className="flex cursor-pointer items-center gap-1.5 rounded-full border px-3.25 py-1.25 text-[12.5px] font-medium"
                                style={cnt > 0 ? { borderColor: "var(--accent-border)", background: "var(--accent-bg)", color: "var(--accent)" } : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
                            >
                                {FACET_LABELS[k]}
                                {cnt > 0 && <span className="rounded-lg bg-(--accent) px-1.25 font-mono text-[10.5px] text-white">{cnt}</span>}
                                <span className="opacity-60">▾</span>
                            </button>
                            {open && (
                                <div className="absolute top-9 left-0 z-20 min-w-42.5 rounded-[10px] border border-(--border) bg-(--raised) p-1.5 shadow-(--shadow)">
                                    {facetData[k].map((v) => {
                                        const checked = filters[k].includes(v);
                                        return (
                                            <button key={v} onClick={() => toggleFilter(k, v)} className="flex w-full cursor-pointer items-center gap-2.25 rounded-[7px] px-2.25 py-1.75 text-left text-[13px] text-(--text) hover:bg-(--line)">
                                                <span className="flex size-3.75 flex-none items-center justify-center rounded-[4px] border-[1.5px] text-[10px] text-white" style={{ borderColor: checked ? "var(--accent)" : "var(--border)", background: checked ? "var(--accent)" : "transparent" }}>{checked ? "✓" : ""}</span>
                                                {v}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="flex-1" />
                <span className="font-mono text-[11px] uppercase tracking-[0.5px] text-(--muted)">sort</span>
                <div className="relative">
                    <button onClick={() => toggleFacet("__sort")} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-(--border) bg-(--surface) px-3.25 py-1.25 text-[12.5px] font-medium text-(--text)">
                        Sort: {sortLabel} <span className="opacity-60">▾</span>
                    </button>
                    {openFacet === "__sort" && (
                        <div className="absolute top-9 right-0 z-20 min-w-37.5 rounded-[10px] border border-(--border) bg-(--raised) p-1.5 shadow-(--shadow)">
                            {SORT_FIELDS.map(([f, label]) => (
                                <button key={f} onClick={() => { setSort((s) => ({ by: f, desc: s.desc })); setOpenFacet(null); }} className="w-full cursor-pointer rounded-[7px] px-2.25 py-1.75 text-left text-[13px]" style={sort.by === f ? { background: "var(--accent-bg)", color: "var(--accent)" } : { color: "var(--text)" }}>{label}</button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => setSort((s) => ({ ...s, desc: !s.desc }))} title="Sort direction" className="cursor-pointer rounded-full border border-(--border) bg-(--surface) px-2.75 py-1.25 text-[12.5px] font-semibold text-(--text)">
                    {sort.desc ? "↓ desc" : "↑ asc"}
                </button>
            </div>

            {/* active chips */}
            {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {chips.map(({ k, v }) => (
                        <button key={`${k}:${v}`} onClick={() => removeFilter(k, v)} className="flex cursor-pointer items-center gap-1.75 rounded-2xl border border-(--border) bg-(--surface) px-2.75 py-0.75 text-[12px] text-(--text2)">
                            <span className="font-mono text-[11px] opacity-70">{k}:</span>{v}<span className="opacity-80">✕</span>
                        </button>
                    ))}
                    <button onClick={resetFilters} className="cursor-pointer text-[12px] font-medium text-(--reject)">clear all</button>
                </div>
            )}

            {/* table */}
            <div className="mt-4 overflow-hidden rounded-[12px] border border-(--border) bg-(--surface)">
                <div className="flex items-center gap-3 border-b border-(--border) bg-(--bg) px-4 py-2.25 font-mono text-[10.5px] tracking-[0.5px] text-(--muted)">
                    <span className="w-9.5 flex-none">ID</span>
                    <span className="min-w-0 flex-1">TITLE</span>
                    <span className="w-23 flex-none">TYPE</span>
                    <span className="w-29.5 flex-none">CATEGORY</span>
                    <span className="w-26 flex-none">STATUS</span>
                    <span className="w-19.5 flex-none">SENS.</span>
                    <span className="w-24 flex-none">CONF.</span>
                    <span className="w-27 flex-none">UPDATED</span>
                </div>
                {rows.map((m) => {
                    const faded = m.status === "superseded" || m.status === "rejected";
                    const secret = m.sensitivity === "secret" || m.sensitivity === "sensitive";
                    const pct = Math.round(m.confidence * 100);
                    return (
                        <button
                            key={m.id}
                            onClick={() => navigate(`/memory/${m.id}`)}
                            className="flex w-full items-center gap-3 border-b border-(--line) px-4 py-2.75 text-left text-[13px] text-(--text) hover:bg-(--line)"
                            style={{ opacity: faded ? 0.62 : 1 }}
                        >
                            <span className="w-9.5 flex-none font-mono text-[11.5px] text-(--muted)">#{m.id}</span>
                            <span className="flex min-w-0 flex-1 items-center gap-1.75 overflow-hidden">
                                {secret && <Lock />}
                                <span className="truncate font-medium" style={{ color: faded ? "var(--text2)" : "var(--text)", textDecoration: faded ? "line-through" : "none" }}>{m.title}</span>
                            </span>
                            <span className="w-23 flex-none text-(--text2)">{m.type}</span>
                            <span className="w-29.5 flex-none text-(--text2)">{m.category}</span>
                            <span className="w-26 flex-none">
                                <span className="rounded-md border px-2 text-[11px] font-semibold" style={statusStyle(m.status)}>{m.status}</span>
                            </span>
                            <span className="w-19.5 flex-none text-[12px]" style={{ color: secret ? "var(--lockfg)" : "var(--muted)" }}>{m.sensitivity}</span>
                            <span className="flex w-24 flex-none items-center gap-1.75">
                                <span className="h-[5px] w-10.5 overflow-hidden rounded-[3px] bg-(--line)"><span className="block h-full" style={{ width: `${pct}%`, background: faded ? "var(--super)" : "var(--text2)" }} /></span>
                                <span className="font-mono text-[11px] text-(--muted)">{pct}</span>
                            </span>
                            <span className="w-27 flex-none font-mono text-[11px] text-(--muted)">{fmt(m.updated_at)}</span>
                        </button>
                    );
                })}
                {rows.length === 0 && (
                    <div className="px-10 py-10 text-center text-[13px] text-(--muted)">
                        No memories match these filters.{" "}
                        <button onClick={resetFilters} className="cursor-pointer font-medium text-(--accent)">Reset</button>
                    </div>
                )}
            </div>
            <div className="mt-2.5 font-mono text-[11.5px] text-(--muted)">click a row to open · filters populated from /memories/facets</div>
        </div>
    );
}

export default Browse;
