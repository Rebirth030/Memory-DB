import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    type Memory,
    type EditableField,
    SENSITIVITIES,
    TYPES,
    CATEGORIES,
    statusStyle,
} from "../types";
import { labelCls, inputCls, selectCls } from "../formStyles";

// --- demo data (replace with GET /memories/:id) ---
const DEMO: Record<number, Memory> = {
    45: { id: 45, title: "Primary editor is Neovim", body: "Switched to Neovim with the LazyVim config. Expects a terminal-first workflow and modal-editor assumptions.", type: "preference", category: "tech_stack", tags: "#editor #neovim", confidence: 0.8, sensitivity: "normal", source: "chat", status: "candidate", supersedes: 12, reason: null, created_at: "2026-06-24 14:02", updated_at: "2026-06-24 14:02", valid_from: null, valid_to: null },
    12: { id: 12, title: "Primary editor is VS Code", body: "Daily editor is Visual Studio Code with a Vim keybindings extension and a handful of TS plugins.", type: "preference", category: "tech_stack", tags: "#editor #vscode", confidence: 0.9, sensitivity: "public", source: "chat", status: "superseded", supersedes: null, reason: null, created_at: "2026-02-05 13:10", updated_at: "2026-06-24 14:02", valid_from: "2026-02-05 13:10", valid_to: "2026-06-24 14:02" },
    8: { id: 8, title: "Primary language is TypeScript", body: "Default to TypeScript for new code. Strong typing preferred over plain JavaScript.", type: "fact", category: "tech_stack", tags: "#typescript", confidence: 1.0, sensitivity: "public", source: "chat", status: "active", supersedes: null, reason: null, created_at: "2026-01-15 14:00", updated_at: "2026-01-15 14:00", valid_from: "2026-01-15 14:00", valid_to: null },
    31: { id: 31, title: "Personal server SSH access note", body: "Bastion host bastion.home.local, user 'core', connects with the id_personal key (passphrase in 1Password).", type: "fact", category: "general", tags: "#ssh #infra", confidence: 1.0, sensitivity: "secret", source: "chat", status: "active", supersedes: null, reason: null, created_at: "2026-05-02 09:10", updated_at: "2026-05-02 09:10", valid_from: "2026-05-02 09:10", valid_to: null },
};

function nowStamp() {
    return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function Detail() {
    // A changing `key` remounts DetailView when the route param changes, so all
    // state resets cleanly — no setState-in-effect. (With a real backend, GET
    // /memories/:id would live in a useEffect inside DetailView.)
    const { id } = useParams();
    return <DetailView key={id} memoryId={Number(id)} />;
}

function DetailView({ memoryId }: { memoryId: number }) {
    const navigate = useNavigate();

    const [memory, setMemory] = useState<Memory | null>(() => DEMO[memoryId] ?? null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Memory | null>(null);

    if (!memory) {
        return (
            <div className="mx-auto max-w-195 px-5.5 pt-6.5 pb-20">
                <button onClick={() => navigate(-1)} className="mb-3.5 cursor-pointer text-[13px] text-(--muted)">← back</button>
                <div className="rounded-xl border border-dashed border-(--border) bg-(--surface) px-5 py-14 text-center text-(--muted)">
                    Memory #{memoryId} not found.
                </div>
            </div>
        );
    }

    // editable fields read from the draft while editing, otherwise from the record
    const m = editing && draft ? draft : memory;
    const pct = Math.round(m.confidence * 100);
    // the memory this one supersedes (read-only view links to it). Later: GET it.
    const sid = memory.supersedes;
    const old = sid != null ? DEMO[sid] : undefined;

    const startEdit = () => { setDraft(memory); setEditing(true); };
    const cancel = () => { setDraft(null); setEditing(false); };
    const save = () => {
        if (!draft) return;
        // later: PATCH /memories/:id with the changed fields, then use the response
        setMemory({ ...draft, updated_at: nowStamp() });
        setDraft(null);
        setEditing(false);
    };
    const setField = <K extends EditableField>(k: K, v: Memory[K]) =>
        setDraft((d) => (d ? { ...d, [k]: v } : d));

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
                    <button onClick={startEdit} className="cursor-pointer rounded-lg border border-(--accent) bg-(--accent) px-5.5 py-2.25 text-[13.5px] font-semibold text-white">✎ Edit</button>
                )}
            </div>
        </div>
    );
}

export default Detail;
