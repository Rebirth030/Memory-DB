import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type FacetKey, type Memory, isFaded, isSecret, statusStyle } from "../types";
import { Lock, SearchIcon } from "../ui";
import { fmt } from "../format";
import { useAsync } from "../hooks/useAsync";
import { getFacets, searchMemories } from "../api";

const FACET_KEYS: FacetKey[] = ["status", "sensitivity", "category", "type", "source"];
const FACET_LABELS: Record<FacetKey, string> = { status: "Status", sensitivity: "Sensitivity", category: "Category", type: "Type", source: "Source" };
const SORT_FIELDS: [keyof Memory, string][] = [
    ["updated_at", "Updated"], ["created_at", "Created"], ["title", "Title"],
    ["confidence", "Confidence"], ["type", "Type"], ["status", "Status"],
];

type Filters = Record<FacetKey, string[]>;
const EMPTY: Filters = { status: [], sensitivity: [], category: [], type: [], source: [] };

function Browse() {
    const navigate = useNavigate();

    // Server data, fetched ONCE on mount. Everything below (search/filter/sort)
    // runs client-side over this list — the store is small & local, so that's
    // instant and avoids a roundtrip per keystroke. The facet options come from
    // GET /memories/facets so the dropdowns always show the FULL range of values,
    // independent of what is currently filtered in.
    const memoriesQuery = useAsync(() => searchMemories(), []);
    const facetsQuery = useAsync(() => getFacets(), []);
    const memories = memoriesQuery.data ?? [];
    const facetData: Filters = facetsQuery.data ?? EMPTY;

    // UI state
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<Filters>(EMPTY);
    const [sort, setSort] = useState<{ by: keyof Memory; desc: boolean }>({ by: "updated_at", desc: true });
    const [openFacet, setOpenFacet] = useState<string | null>(null);

    // client-side filter: facet checkboxes (AND across facets) + free-text over title/body/tags
    const q = search.trim().toLowerCase();
    const filtered = memories.filter((m) => {
        for (const k of FACET_KEYS) {
            if (filters[k].length && !filters[k].includes(String(m[k]))) return false;
        }
        return !q || `${m.title} ${m.body} ${m.tags}`.toLowerCase().includes(q);
    });

    // client-side sort
    const by = sort.by;
    const rows = [...filtered].sort((a, b) =>
        by === "confidence"
            ? a.confidence - b.confidence
            : String(a[by] ?? "").localeCompare(String(b[by] ?? "")),
    );
    if (sort.desc) rows.reverse();

    const toggleFacet = (k: string) => setOpenFacet((o) => (o === k ? null : k));
    const toggleFilter = (k: FacetKey, v: string) =>
        setFilters((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));
    const removeFilter = (k: FacetKey, v: string) =>
        setFilters((f) => ({ ...f, [k]: f[k].filter((x) => x !== v) }));
    const resetFilters = () => { setFilters(EMPTY); setSearch(""); setOpenFacet(null); };

    const chips = FACET_KEYS.flatMap((k) => filters[k].map((v) => ({ k, v })));
    const sortLabel = SORT_FIELDS.find(([f]) => f === sort.by)?.[1] ?? "";

    if (memoriesQuery.loading) {
        return <div className="mx-auto max-w-310 px-5.5 pt-6.5 text-[13px] text-(--muted)">Loading memories…</div>;
    }
    if (memoriesQuery.error) {
        return (
            <div className="mx-auto max-w-310 px-5.5 pt-6.5">
                <div className="rounded-[12px] border border-(--reject) bg-(--reject-bg) px-4 py-3 text-[13px] text-(--reject)">
                    Failed to load memories: {memoriesQuery.error}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-310 px-5.5 pt-6.5 pb-20">
            {/* header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-[25px] font-semibold tracking-[-0.4px]">Library</h1>
                    <div className="mt-0.75 text-[13px] text-(--muted)">All memories — every status &amp; sensitivity, including secrets.</div>
                </div>
                <div className="font-mono text-[12px] text-(--muted)">{rows.length} / {memories.length} shown</div>
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
                                    {facetData[k].length === 0 && <div className="px-2.25 py-1.75 text-[12px] text-(--muted)">no options</div>}
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
                    const faded = isFaded(m.status);
                    const secret = isSecret(m.sensitivity);
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
