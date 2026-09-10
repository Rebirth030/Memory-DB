import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    type Memory,
    type MemoryUpdate,
    type EditableField,
    EDITABLE_FIELDS,
    SENSITIVITIES,
    TYPES,
    CATEGORIES,
    statusStyle,
} from "../types";
import { labelCls, inputCls, selectCls } from "../formStyles";
import { useAsync } from "../hooks/useAsync";
import { getMemory, purgeMemory, updateMemory } from "../api";

function Detail() {
    // A changing `key` remounts DetailView when the route param changes, so all
    // state (and the fetch) resets cleanly — no setState-in-effect needed.
    const { id } = useParams();
    return <DetailView key={id} memoryId={Number(id)} />;
}

function DetailView({ memoryId }: { memoryId: number }) {
    const navigate = useNavigate();

    // Initial load. After a successful save, `saved` (the PATCH response) takes
    // over so we show the fresh record without a refetch.
    const query = useAsync(() => getMemory(memoryId), [memoryId]);
    const [saved, setSaved] = useState<Memory | null>(null);
    const memory = saved ?? query.data ?? null;

    // Edit state
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Memory | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // The memory this one supersedes — fetched only when present, for the link label.
    const sid = memory?.supersedes ?? null;
    const oldQuery = useAsync(() => (sid != null ? getMemory(sid) : Promise.resolve(null)), [sid]);
    const old = oldQuery.data;

    if (query.loading && !memory) {
        return <div className="mx-auto max-w-195 px-5.5 pt-6.5 text-[13px] text-(--muted)">Loading memory…</div>;
    }
    if (!memory) {
        return (
            <div className="mx-auto max-w-195 px-5.5 pt-6.5 pb-20">
                <button onClick={() => navigate(-1)} className="mb-3.5 cursor-pointer text-[13px] text-(--muted)">← back</button>
                <div className="rounded-xl border border-dashed border-(--border) bg-(--surface) px-5 py-14 text-center text-(--muted)">
                    {query.error ? `Could not load memory #${memoryId}: ${query.error}` : `Memory #${memoryId} not found.`}
                </div>
            </div>
        );
    }

    // While editing we render from the draft, otherwise from the record.
    const m = editing && draft ? draft : memory;
    const pct = Math.round(m.confidence * 100);

    const startEdit = () => { setDraft(memory); setSaveError(null); setEditing(true); };
    const cancel = () => { setDraft(null); setSaveError(null); setEditing(false); };
    const save = async () => {
        if (!draft) return;
        // Send only the fields that actually changed — a real partial PATCH.
        const patch: MemoryUpdate = {};
        for (const k of EDITABLE_FIELDS) {
            if (draft[k] !== memory[k]) (patch as Record<EditableField, unknown>)[k] = draft[k];
        }
        if (Object.keys(patch).length === 0) { cancel(); return; }  // nothing changed
        try {
            setSaved(await updateMemory(memoryId, patch));  // response = fresh record
            setDraft(null);
            setEditing(false);
        } catch (e) {
            setSaveError((e as Error).message);
        }
    };
    const setField = <K extends EditableField>(k: K, v: Memory[K]) =>
        setDraft((d) => (d ? { ...d, [k]: v } : d));

    // Unlike reject/supersede (which only move the status), this really removes
    // the text — so it asks first, and there's nothing to come back to after.
    const remove = async () => {
        try {
            await purgeMemory(memoryId);
            navigate("/browse");
        } catch (e) {
            setSaveError((e as Error).message);
            setConfirmDelete(false);
        }
    };

    return (
        <div className="mx-auto max-w-195 px-5.5 pt-6.5 pb-20">
            <button onClick={() => navigate(-1)} className="mb-3.5 cursor-pointer text-[13px] text-(--muted)">← back</button>

            {/* header (always read-only) */}
            <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[13px] text-(--muted)">memory #{memory.id}</span>
                <span className="rounded-md border px-2 text-[11px] font-semibold" style={statusStyle(memory.status)}>{memory.status}</span>
                <span className="text-[11.5px] text-(--muted)">status changes only via review</span>
            </div>

            {/* title */}
            <label className={labelCls}>Title</label>
            {editing ? (
                <input value={m.title} onChange={(e) => setField("title", e.target.value)} className={`${inputCls} mb-3.5 text-[17px] font-semibold`} />
            ) : (
                <div className="mb-3.5 text-[20px] font-semibold">{m.title}</div>
            )}

            {/* body */}
            <label className={labelCls}>Body</label>
            {editing ? (
                <textarea value={m.body} onChange={(e) => setField("body", e.target.value)} rows={4} className={`${inputCls} mb-3.5 resize-y leading-relaxed text-(--text2)`} />
            ) : (
                <div className="mb-3.5 text-[14px] leading-relaxed whitespace-pre-wrap text-(--text2)">{m.body}</div>
            )}

            {/* field grid */}
            <div className="mb-3.5 grid grid-cols-2 gap-3.25">
                <div>
                    <label className={labelCls}>Type</label>
                    {editing ? (
                        <select value={m.type} onChange={(e) => setField("type", e.target.value)} className={selectCls}>
                            {TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : <div className="text-[14px]">{m.type}</div>}
                </div>
                <div>
                    <label className={labelCls}>Category</label>
                    {editing ? (
                        <select value={m.category} onChange={(e) => setField("category", e.target.value)} className={selectCls}>
                            {CATEGORIES.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : <div className="text-[14px]">{m.category}</div>}
                </div>
                <div className="col-span-2">
                    <label className={labelCls}>Tags</label>
                    {editing ? (
                        <input value={m.tags} onChange={(e) => setField("tags", e.target.value)} className={`${selectCls} font-mono`} />
                    ) : <div className="font-mono text-[13.5px] text-(--text2)">{m.tags || "—"}</div>}
                </div>
                <div>
                    <label className={labelCls}>Confidence · {pct}%</label>
                    {editing ? (
                        <input type="range" min={0} max={1} step={0.05} value={m.confidence} onChange={(e) => setField("confidence", parseFloat(e.target.value))} className="mt-1.75 w-full accent-(--accent)" />
                    ) : (
                        <span className="flex items-center gap-2.5">
                            <span className="h-1.5 w-32 overflow-hidden rounded-[3px] bg-(--line)"><span className="block h-full bg-(--text2)" style={{ width: `${pct}%` }} /></span>
                            <span className="font-mono text-[12px] text-(--muted)">{pct}%</span>
                        </span>
                    )}
                </div>
                <div>
                    <label className={labelCls}>Sensitivity</label>
                    {editing ? (
                        <select value={m.sensitivity} onChange={(e) => setField("sensitivity", e.target.value as Memory["sensitivity"])} className={selectCls}>
                            {SENSITIVITIES.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : <div className="text-[14px]">{m.sensitivity}</div>}
                </div>
                <div>
                    <label className={labelCls}>Valid from</label>
                    {editing ? (
                        <input value={m.valid_from ?? ""} onChange={(e) => setField("valid_from", e.target.value || null)} className={`${selectCls} font-mono text-(--text2)`} />
                    ) : <div className="font-mono text-[12.5px] text-(--text2)">{m.valid_from ?? "—"}</div>}
                </div>
                <div>
                    <label className={labelCls}>Valid to</label>
                    {editing ? (
                        <input value={m.valid_to ?? ""} onChange={(e) => setField("valid_to", e.target.value || null)} placeholder="— always —" className={`${selectCls} font-mono text-(--text2)`} />
                    ) : <div className="font-mono text-[12.5px] text-(--text2)">{m.valid_to ?? "— always —"}</div>}
                </div>
                <div className="col-span-2">
                    <label className={labelCls}>Supersedes — which memory this replaces</label>
                    {editing ? (
                        <input
                            type="number"
                            value={m.supersedes ?? ""}
                            onChange={(e) => setField("supersedes", e.target.value === "" ? null : Number(e.target.value))}
                            placeholder="memory # this replaces (empty = none)"
                            className={`${selectCls} font-mono`}
                        />
                    ) : sid != null ? (
                        <button
                            onClick={() => navigate(`/memory/${sid}`)}
                            className="cursor-pointer font-mono text-[13.5px] text-(--accent) hover:underline"
                        >
                            #{sid}{old?.title ? ` · ${old.title}` : ""} <span className="opacity-70">→ open</span>
                        </button>
                    ) : (
                        <div className="text-[14px] text-(--muted)">—</div>
                    )}
                </div>
            </div>

            {/* read-only meta */}
            <div className="flex flex-wrap gap-4.5 rounded-[10px] border border-(--line) bg-(--bg) px-3.5 py-2.75 font-mono text-[12px] text-(--muted)">
                <span>source: {memory.source}</span>
                <span>created: {memory.created_at}</span>
                <span>updated: {memory.updated_at}</span>
            </div>

            {/* actions */}
            <div className="mt-4.5 flex items-center gap-2.5">
                {editing ? (
                    <>
                        <button onClick={save} className="cursor-pointer rounded-lg border border-(--accent) bg-(--accent) px-5.5 py-2.25 text-[13.5px] font-semibold text-white">Save changes</button>
                        <button onClick={cancel} className="cursor-pointer rounded-lg border border-(--border) bg-(--surface) px-4.5 py-2.25 text-[13.5px] text-(--text2)">Cancel</button>
                    </>
                ) : (
                    <>
                        <button onClick={startEdit} className="cursor-pointer rounded-lg border border-(--accent) bg-(--accent) px-5.5 py-2.25 text-[13.5px] font-semibold text-white">✎ Edit</button>
                        <div className="flex-1" />
                        <button onClick={() => setConfirmDelete(true)} className="cursor-pointer text-[12.5px] text-(--muted) hover:text-(--reject)">Delete permanently</button>
                    </>
                )}
                {saveError && <span className="text-[12.5px] text-(--reject)">{saveError}</span>}
            </div>

            {confirmDelete && (
                <div className="mt-3 rounded-[10px] border border-(--reject) bg-(--reject-bg) px-3.5 py-3">
                    <div className="text-[13px] font-semibold text-(--reject)">Delete memory #{memory.id} for good?</div>
                    <div className="mt-1 text-[12.5px] text-(--text2)">
                        Removes the text from the database and the search index. Rejecting or
                        superseding only changes the status — this doesn’t. It can’t be undone.
                    </div>
                    <div className="mt-2.5 flex gap-2">
                        <button onClick={remove} className="cursor-pointer rounded-[7px] border border-(--reject) bg-(--reject) px-3.5 py-1.25 text-[12.5px] font-semibold text-white">Delete permanently</button>
                        <button onClick={() => setConfirmDelete(false)} className="cursor-pointer text-[12.5px] text-(--muted)">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Detail;
