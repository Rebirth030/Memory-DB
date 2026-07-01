import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Sensitivity } from "../types";
import { Lock } from "../ui";

interface Candidate {
    id: number;
    title: string;
    body: string;
    type: string;
    category: string;
    tags: string;
    confidence: number;
    sensitivity: Sensitivity;
    source: string;
    supersedes: number | null;
}

// --- demo data (replace with POST /memories/search {choices:{status:['candidate']}}) ---
const CANDIDATES: Candidate[] = [
    { id: 45, title: "Primary editor is Neovim", body: "Switched to Neovim with the LazyVim config. Expects a terminal-first workflow and modal-editor assumptions.", type: "preference", category: "tech_stack", tags: "#editor #neovim", confidence: 0.8, sensitivity: "normal", source: "chat", supersedes: 12 },
    { id: 46, title: "Prefers tabs over spaces in code", body: "Uses tab indentation rather than spaces; expects editor config and formatters to follow suit across projects.", type: "preference", category: "tech_stack", tags: "#tabs #formatting", confidence: 0.7, sensitivity: "normal", source: "chat", supersedes: null },
    { id: 47, title: "Home address", body: "48 Rue des Lilas, 75011 Paris, France. 3rd floor, door code 4821B.", type: "fact", category: "general", tags: "#address", confidence: 1.0, sensitivity: "secret", source: "chat", supersedes: null },
    { id: 48, title: "Allergic to penicillin", body: "Documented penicillin allergy — avoid any medical or dosage suggestions involving it.", type: "fact", category: "general", tags: "#health", confidence: 1.0, sensitivity: "sensitive", source: "chat", supersedes: null },
];
// the active memories a `supersedes` candidate would replace (for the diff)
const OLD: Record<number, { title: string; body: string }> = {
    12: { title: "Primary editor is VS Code", body: "Daily editor is Visual Studio Code with a Vim keybindings extension and a handful of TS plugins." },
};

const SHORTCUTS = [
    { k: "A", label: "approve" },
    { k: "R", label: "reject" },
    { k: "E", label: "edit" },
    { k: "J / K", label: "next / prev" },
];

function Review() {
    const navigate = useNavigate();

    // phase: drive from the real fetch later (loading → ready / error)
    const [phase] = useState<"loading" | "error" | "ready">("ready");
    const [decided, setDecided] = useState<Record<number, "approved" | "rejected">>({});
    const [selected, setSelected] = useState<number[]>([]);
    const [expanded, setExpanded] = useState<number[]>([]);
    const [revealed, setRevealed] = useState<number[]>([]);
    const [rejecting, setRejecting] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [cursor, setCursor] = useState(0);

    const queue = CANDIDATES.filter((c) => !decided[c.id]);
    const cur = Math.max(0, Math.min(cursor, queue.length - 1));

    // keyboard navigation (j/k move, a approve, r reject, e edit, esc cancel)
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select") return;
            const q = CANDIDATES.filter((c) => !decided[c.id]);
            if (!q.length) return;
            const c = Math.max(0, Math.min(cursor, q.length - 1));
            const k = e.key.toLowerCase();
            if (k === "j") { setCursor(Math.min(c + 1, q.length - 1)); e.preventDefault(); }
            else if (k === "k") { setCursor(Math.max(c - 1, 0)); e.preventDefault(); }
            else if (k === "a") { setDecided((d) => ({ ...d, [q[c].id]: "approved" })); setSelected((s) => s.filter((x) => x !== q[c].id)); e.preventDefault(); }
            else if (k === "r") { setRejecting(q[c].id); setRejectReason(""); e.preventDefault(); }
            else if (k === "e") { navigate(`/memory/${q[c].id}`); e.preventDefault(); }
            else if (k === "escape") { setRejecting(null); }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [decided, cursor, navigate]);

    const approve = (id: number) => {
        setDecided((d) => ({ ...d, [id]: "approved" }));
        setSelected((s) => s.filter((x) => x !== id));
    };
    const confirmReject = (id: number) => {
        setDecided((d) => ({ ...d, [id]: "rejected" }));
        setRejecting(null);
        setSelected((s) => s.filter((x) => x !== id));
    };
    const toggle = (list: number[], id: number) =>
        list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

    const candidateBadge = { color: "var(--cand)", background: "var(--cand-bg)", borderColor: "var(--accent-border)" };

    return (
        <div className="mx-auto max-w-310 px-5.5 pt-6.5 pb-20">
            {/* header */}
            <div className="mb-3.5">
                <h1 className="text-[25px] font-semibold tracking-[-0.4px]">Review Queue</h1>
                <div className="mt-0.75 text-[13px] text-(--muted)">
                    Candidates proposed by your assistants — approve, reject, or edit. Newest first.
                </div>
            </div>

            {phase === "loading" && (
                <div className="flex flex-col gap-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-26 animate-pulse rounded-[12px] border border-(--line) bg-(--surface)" />
                    ))}
                    <div className="text-center font-mono text-[12.5px] text-(--muted)">loading candidates…</div>
                </div>
            )}

            {phase === "error" && (
                <div className="rounded-[14px] border border-(--reject) bg-(--reject-bg) px-5 py-13 text-center">
                    <div className="mx-auto mb-3.5 flex size-13 items-center justify-center rounded-full border-2 border-(--reject) text-[26px] font-bold text-(--reject)">!</div>
                    <div className="text-[18px] font-semibold">Couldn’t reach the API</div>
                    <div className="mt-1.5 text-[13.5px] text-(--text2)">
                        Is the FastAPI server running on <span className="font-mono text-[12.5px] text-(--text)">127.0.0.1:8000</span>?
                    </div>
                    <button className="mt-4.5 cursor-pointer rounded-lg border border-(--border) bg-(--surface) px-5 py-2 text-[13px] font-medium text-(--text)">
                        ↻ Retry
                    </button>
                </div>
            )}

            {phase === "ready" && queue.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-(--border) bg-(--surface) px-5 py-16 text-center">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border-2 border-(--active) text-[28px] text-(--active)">✓</div>
                    <div className="text-[19px] font-semibold">Queue clear</div>
                    <div className="mx-auto mt-1.5 max-w-95 text-[13.5px] leading-relaxed text-(--muted)">
                        Nothing waiting for review. New candidates from Claude &amp; Codex land here as they’re proposed.
                    </div>
                    <button
                        onClick={() => navigate("/browse")}
                        className="mt-4.5 cursor-pointer rounded-lg border border-(--border) bg-(--raised) px-4.5 py-2 text-[13px] font-medium text-(--text)"
                    >
                        Browse library →
                    </button>
                </div>
            )}

            {phase === "ready" && queue.length > 0 && (
                <>
                    {/* keyboard hint bar */}
                    <div className="mt-3.5 mb-4 flex flex-wrap items-center gap-4 rounded-[10px] border border-(--line) bg-(--surface) px-3.5 py-2.25 text-[12.5px] text-(--text2)">
                        <span className="font-mono text-[11px] uppercase tracking-[0.5px] text-(--muted)">shortcuts</span>
                        {SHORTCUTS.map((s) => (
                            <span key={s.k} className="flex items-center gap-1.5">
                                <kbd className="rounded-[5px] border border-b-2 border-(--border) bg-(--raised) px-1.75 font-mono text-[11px] text-(--text)">{s.k}</kbd>
                                {s.label}
                            </span>
                        ))}
                    </div>

                    {/* bulk bar */}
                    {selected.length > 0 && (
                        <div className="mb-3.5 flex items-center gap-3 rounded-[10px] border border-(--accent-border) bg-(--accent-bg) px-3.5 py-2.25 text-[13px]">
                            <span className="font-semibold">{selected.length} selected</span>
                            <div className="flex-1" />
                            <button
                                onClick={() => { setDecided((d) => { const n = { ...d }; selected.forEach((i) => (n[i] = "approved")); return n; }); setSelected([]); }}
                                className="cursor-pointer rounded-[7px] border border-(--active) bg-(--active-bg) px-3.25 py-1.25 text-[12.5px] font-semibold text-(--active)"
                            >✓ Approve selected</button>
                            <button
                                onClick={() => { setDecided((d) => { const n = { ...d }; selected.forEach((i) => (n[i] = "rejected")); return n; }); setSelected([]); }}
                                className="cursor-pointer rounded-[7px] border border-(--reject) bg-(--reject-bg) px-3.25 py-1.25 text-[12.5px] font-semibold text-(--reject)"
                            >✕ Reject selected</button>
                            <button onClick={() => setSelected([])} className="cursor-pointer text-[12.5px] text-(--muted)">clear</button>
                        </div>
                    )}

                    {/* queue */}
                    <div className="flex flex-col gap-3">
                        {queue.map((q, i) => {
                            const secret = q.sensitivity === "secret" || q.sensitivity === "sensitive";
                            const shown = !secret || revealed.includes(q.id);
                            const isCursor = i === cur;
                            const sel = selected.includes(q.id);
                            const old = q.supersedes != null ? OLD[q.supersedes] : null;
                            const exp = expanded.includes(q.id);
                            const confPct = Math.round(q.confidence * 100);
                            return (
                                <div
                                    key={q.id}
                                    className="flex overflow-hidden rounded-[12px] border bg-(--surface)"
                                    style={{ borderColor: isCursor ? "var(--accent)" : "var(--border)", boxShadow: isCursor ? "0 0 0 1px var(--accent-border)" : "none" }}
                                >
                                    <div className="w-[3px] flex-none bg-(--cand)" />
                                    <div className="min-w-0 flex-1 p-4">
                                        <div className="flex items-start gap-2.75">
                                            <button
                                                onClick={() => setSelected((s) => toggle(s, q.id))}
                                                className="mt-0.5 flex size-4.25 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-[11px] text-white"
                                                style={{ borderColor: sel ? "var(--accent)" : "var(--border)", background: sel ? "var(--accent)" : "transparent" }}
                                            >{sel ? "✓" : ""}</button>
                                            <div className="min-w-0 flex-1">
                                                {/* title row */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[15.5px] font-semibold" style={{ color: secret && !shown ? "var(--text2)" : "var(--text)" }}>{q.title}</span>
                                                    <span className="rounded-md border px-1.75 text-[11px] font-semibold" style={candidateBadge}>candidate</span>
                                                    {q.supersedes != null && (
                                                        <span className="rounded-md border border-(--border) px-1.75 font-mono text-[11px] text-(--text2)">↔ replaces #{q.supersedes}</span>
                                                    )}
                                                    {secret && (
                                                        <span className="flex items-center gap-1.25 rounded-md border border-(--border) bg-(--lockbg) px-1.75 text-[11px] text-(--lockfg)"><Lock />{q.sensitivity}</span>
                                                    )}
                                                </div>
                                                {/* meta row */}
                                                <div className="my-1.75 flex flex-wrap items-center gap-2.5 font-mono text-[12px] text-(--muted)">
                                                    <span>{q.type}</span><span>·</span><span>{q.category}</span>
                                                    {q.tags && <span className="text-(--text2)">{q.tags}</span>}
                                                    <span className="flex items-center gap-1.5">
                                                        conf
                                                        <span className="h-[5px] w-[46px] overflow-hidden rounded-[3px] bg-(--line)"><span className="block h-full bg-(--text2)" style={{ width: `${confPct}%` }} /></span>
                                                        {confPct}%
                                                    </span>
                                                    <span>· {q.source}</span>
                                                </div>
                                                {/* body or reveal */}
                                                {shown ? (
                                                    <div className="line-clamp-2 text-[13.5px] leading-relaxed text-(--text2)">{q.body}</div>
                                                ) : (
                                                    <button
                                                        onClick={() => setRevealed((r) => [...r, q.id])}
                                                        className="flex w-full cursor-pointer items-center gap-2.25 rounded-lg border border-dashed border-(--border) bg-(--lockbg) px-3 py-2.25 text-left text-[12.5px] text-(--muted)"
                                                    >
                                                        ••••••••••••••••
                                                        <span className="ml-auto rounded-xl border border-(--border) px-2.25 text-[11px] text-(--text2)">click to reveal</span>
                                                    </button>
                                                )}
                                                {/* supersede compare */}
                                                {old && (
                                                    <div className="mt-2.25 border-t border-dashed border-(--line) pt-2">
                                                        {!exp ? (
                                                            <button onClick={() => setExpanded((x) => toggle(x, q.id))} className="cursor-pointer text-left text-[12px] text-(--muted)">
                                                                replaces <span className="text-(--text2)">“{old.title}”</span> <span className="font-medium text-(--accent)">· compare ▾</span>
                                                            </button>
                                                        ) : (
                                                            <div>
                                                                <button onClick={() => setExpanded((x) => toggle(x, q.id))} className="cursor-pointer pb-2 text-left text-[12px] font-medium text-(--accent)">hide comparison ▴</button>
                                                                <div className="flex items-stretch gap-2.25">
                                                                    <div className="flex-1 rounded-[9px] border border-dashed border-(--border) bg-(--bg) p-2.5">
                                                                        <div className="mb-1 font-mono text-[10.5px] tracking-[0.4px] text-(--muted)">CURRENT · #{q.supersedes}</div>
                                                                        <div className="text-[13px] font-semibold text-(--text2) line-through">{old.title}</div>
                                                                        <div className="mt-1 text-[12px] leading-snug text-(--muted)">{old.body}</div>
                                                                        <div className="mt-1.75 font-mono text-[10.5px] text-(--super)">→ becomes superseded</div>
                                                                    </div>
                                                                    <div className="flex items-center text-[16px] text-(--accent)">→</div>
                                                                    <div className="flex-1 rounded-[9px] border border-(--accent-border) bg-(--cand-bg) p-2.5">
                                                                        <div className="mb-1 font-mono text-[10.5px] tracking-[0.4px] text-(--cand)">NEW · #{q.id}</div>
                                                                        <div className="text-[13px] font-semibold text-(--text)">{q.title}</div>
                                                                        <div className="mt-1 text-[12px] leading-snug text-(--text2)">{q.body}</div>
                                                                        <div className="mt-1.75 font-mono text-[10.5px] text-(--active)">→ becomes active</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {/* reject reason */}
                                                {rejecting === q.id && (
                                                    <div className="mt-2.5 rounded-[9px] border border-(--reject) bg-(--reject-bg) p-2.75">
                                                        <div className="mb-1.5 text-[12px] font-semibold text-(--reject)">Reject — reason (optional)</div>
                                                        <input
                                                            value={rejectReason}
                                                            onChange={(e) => setRejectReason(e.target.value)}
                                                            placeholder="e.g. already captured, or incorrect…"
                                                            className="w-full rounded-[7px] border border-(--border) bg-(--surface) px-2.5 py-2 text-[13px] text-(--text)"
                                                        />
                                                        <div className="mt-2.25 flex gap-2">
                                                            <button onClick={() => confirmReject(q.id)} className="cursor-pointer rounded-[7px] border border-(--reject) bg-(--reject) px-3.5 py-1.25 text-[12.5px] font-semibold text-white">Confirm reject</button>
                                                            <button onClick={() => setRejecting(null)} className="cursor-pointer text-[12.5px] text-(--muted)">cancel</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* action rail */}
                                    <div className="flex w-27 flex-none flex-col border-l border-(--line)">
                                        <button onClick={() => approve(q.id)} className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.75 border-b border-(--line) text-[13px] font-semibold text-(--active)">
                                            <span className="text-[15px]">✓</span>{q.supersedes != null ? "Approve & swap" : "Approve"}
                                            <kbd className="rounded-[4px] border border-(--border) px-1.25 font-mono text-[10px] font-normal text-(--muted)">A</kbd>
                                        </button>
                                        <button onClick={() => { setRejecting(q.id); setRejectReason(""); }} className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.75 border-b border-(--line) text-[13px] font-semibold text-(--reject)">
                                            <span className="text-[15px]">✕</span>Reject
                                            <kbd className="rounded-[4px] border border-(--border) px-1.25 font-mono text-[10px] font-normal text-(--muted)">R</kbd>
                                        </button>
                                        <button onClick={() => navigate(`/memory/${q.id}`)} className="flex h-8.5 flex-none cursor-pointer items-center justify-center gap-1.25 text-[12px] text-(--muted)">✎ Edit</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

export default Review;
