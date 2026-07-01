import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Sensitivity, SENSITIVITIES, TYPES, CATEGORIES } from "../types";
import { labelCls, inputCls, selectCls } from "../formStyles";

function Add() {
    const navigate = useNavigate();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [type, setType] = useState("note");
    const [category, setCategory] = useState("general");
    const [tags, setTags] = useState("");
    const [sensitivity, setSensitivity] = useState<Sensitivity>("normal");
    const [source, setSource] = useState("chat");
    const [supersedes, setSupersedes] = useState<number | null>(null);

    const canSave = title.trim() !== "" && body.trim() !== "";

    const add = () => {
        if (!canSave) return;
        // later: POST /memories/commit with this payload, then navigate to the new row
        // body = { title, body, type, category, tags, sensitivity, source, supersedes }
        navigate("/browse");
    };

    return (
        <div className="mx-auto max-w-155 px-5.5 pt-6.5 pb-20">
            <h1 className="text-[25px] font-semibold tracking-[-0.4px]">Add memory</h1>
            <div className="mt-1 text-[13px] text-(--muted)">
                Creates directly as{" "}
                <span className="rounded-md border px-1.75 text-[11px] font-semibold" style={{ color: "var(--active)", background: "var(--active-bg)", borderColor: "var(--active)" }}>active</span>
                {" "}— skips review. Set <span className="font-mono">Supersedes</span> to replace an existing active memory; it is retired in the same step.
            </div>

            <div className="mt-4.5">
                <label className={labelCls}>Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short, descriptive title…" className={`${inputCls} text-[15px]`} />
            </div>

            <div className="mt-3.25">
                <label className={labelCls}>Body *</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="The actual memory content…" className={`${inputCls} resize-y leading-relaxed`} />
            </div>

            <div className="mt-3.25 grid grid-cols-2 gap-3.25">
                <div>
                    <label className={labelCls}>Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                        {TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                        {CATEGORIES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="col-span-2">
                    <label className={labelCls}>Tags</label>
                    <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="free-text search terms…" className={`${selectCls} font-mono`} />
                </div>
                <div>
                    <label className={labelCls}>Sensitivity</label>
                    <select value={sensitivity} onChange={(e) => setSensitivity(e.target.value as Sensitivity)} className={selectCls}>
                        {SENSITIVITIES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Source</label>
                    <input value={source} onChange={(e) => setSource(e.target.value)} className={selectCls} />
                </div>
                <div className="col-span-2">
                    <label className={labelCls}>Supersedes — which memory this replaces (optional)</label>
                    <input
                        type="number"
                        value={supersedes ?? ""}
                        onChange={(e) => setSupersedes(e.target.value === "" ? null : Number(e.target.value))}
                        placeholder="memory # to replace (empty = none)"
                        className={`${selectCls} font-mono`}
                    />
                </div>
            </div>

            <div className="mt-4.5 flex items-center gap-2.5">
                <button
                    onClick={add}
                    disabled={!canSave}
                    className="rounded-lg border border-(--accent) bg-(--accent) px-5.5 py-2.25 text-[13.5px] font-semibold text-white enabled:cursor-pointer disabled:opacity-50"
                >
                    Add memory
                </button>
                <button onClick={() => navigate("/browse")} className="cursor-pointer rounded-lg border border-(--border) bg-(--surface) px-4.5 py-2.25 text-[13.5px] text-(--text2)">
                    Cancel
                </button>
            </div>
        </div>
    );
}

export default Add;
