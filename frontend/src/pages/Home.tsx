import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Status, statusStyle } from "../types";
import { Lock } from "../ui";

// --- demo data (replace with API calls later) ---
const RECENT: { id: number; title: string; status: Status; date: string; secret: boolean }[] = [
    { id: 8, title: "Primary language is TypeScript", status: "active", date: "Jan 15", secret: false },
    { id: 3, title: "Ship Memory DB v1 by Q3", status: "active", date: "Feb 11", secret: false },
    { id: 31, title: "Personal server SSH access note", status: "active", date: "May 2", secret: true },
    { id: 12, title: "Primary editor is VS Code", status: "superseded", date: "Jun 24", secret: false },
    { id: 5, title: "Avoid emoji in code comments", status: "active", date: "Mar 2", secret: false },
];
const BY_CATEGORY: { name: string; count: number }[] = [
    { name: "tech_stack", count: 3 },
    { name: "communication", count: 2 },
    { name: "general", count: 2 },
    { name: "work", count: 1 },
    { name: "hardware", count: 1 },
];

function Home() {
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });
    const hour = new Date().getHours();
    const greeting =
        hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    // placeholder values — wire these to GET /memories/facets + search counts later
    const [openReviews] = useState(0);
    const [activeMemories] = useState(4);
    const [secretMemories] = useState(6);
    const [totalMemories] = useState(10);
    const navigate = useNavigate();

    const catMax = Math.max(1, ...BY_CATEGORY.map((c) => c.count));

    const stats = [
        { value: activeMemories, label: "Active memories", color: "var(--active)", lock: false, go: () => navigate("/browse") },
        { value: openReviews, label: "Pending review", color: openReviews > 0 ? "var(--accent)" : "var(--text2)", lock: false, go: () => navigate("/review") },
        { value: secretMemories, label: "Secret / sensitive", color: "var(--lockfg)", lock: true, go: () => navigate("/browse") },
        { value: totalMemories, label: "Total in library", color: "var(--text)", lock: false, go: () => navigate("/browse") },
    ];

    return (
        <div className="mx-auto max-w-310 px-5.5 pt-6.5 pb-20">
            {/* greeting */}
            <div className="mb-5.5">
                <div className="font-mono text-[12px] tracking-[0.4px] text-(--muted)">
                    {today}
                </div>
                <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-0.6px]">
                    {greeting}.
                </h1>
                <p className="mt-1.25 text-[14px] text-(--text2)">
                    {openReviews > 0
                        ? `You have ${openReviews} ${openReviews === 1 ? "memory" : "memories"} waiting for review.`
                        : "Everything is reviewed — your knowledge base is up to date."}
                </p>
            </div>

            {/* primary: review queue CTA */}
            <button
                onClick={() => navigate("/review")}
                className="flex w-full cursor-pointer items-center gap-5 rounded-2xl border border-(--accent-border) bg-(--accent-bg) px-6 py-5.5 text-left shadow-(--shadow)"
            >
                <div className="flex size-15 flex-none items-center justify-center rounded-[14px] bg-(--accent) font-mono text-[26px] font-semibold text-white">
                    {openReviews}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[18px] font-semibold text-(--text)">
                        Review queue
                    </div>
                    <div className="mt-0.75 text-[13.5px] text-(--text2)">
                        New candidates proposed by Claude &amp; Codex are waiting.
                    </div>
                </div>
                <span className="flex flex-none items-center gap-2 text-[13px] font-semibold text-(--accent)">
                    Start review <span className="text-[16px]">&rarr;</span>
                </span>
            </button>

            {/* stats grid */}
            <div className="mt-3.25 grid grid-cols-4 gap-3.25">
                {stats.map((st) => (
                    <button
                        key={st.label}
                        onClick={st.go}
                        className="cursor-pointer rounded-[13px] border border-(--border) bg-(--surface) px-4.25 py-4 text-left"
                    >
                        <div className="flex items-baseline gap-1.75">
                            <span className="font-mono text-[26px] font-semibold" style={{ color: st.color }}>
                                {st.value}
                            </span>
                            {st.lock && <Lock />}
                        </div>
                        <div className="mt-1.5 text-[12.5px] text-(--text2)">{st.label}</div>
                    </button>
                ))}
            </div>

            {/* two columns: recent + breakdown */}
            <div className="mt-3.25 grid grid-cols-[1.35fr_1fr] gap-3.25">
                {/* recently active */}
                <div className="rounded-[13px] border border-(--border) bg-(--surface) px-1.5 pt-1.5 pb-2">
                    <div className="flex items-center justify-between px-3.25 pt-2.75 pb-2.25">
                        <div className="text-[13px] font-semibold">Recently active</div>
                        <button
                            onClick={() => navigate("/browse")}
                            className="cursor-pointer border-none bg-none text-[12px] text-(--muted)"
                        >
                            all &rarr;
                        </button>
                    </div>
                    {RECENT.map((r) => {
                        const faded = r.status === "superseded" || r.status === "rejected";
                        return (
                            <button
                                key={r.id}
                                onClick={() => navigate(`/memory/${r.id}`)}
                                className="flex w-full cursor-pointer items-center gap-2.75 rounded-[9px] px-3.25 py-2.25 text-left hover:bg-(--line)"
                            >
                                <span className="w-6.5 flex-none font-mono text-[11px] text-(--muted)">
                                    #{r.id}
                                </span>
                                <span className="flex min-w-0 flex-1 items-center gap-1.75 overflow-hidden">
                                    {r.secret && <Lock />}
                                    <span
                                        className="truncate text-[13.5px] font-medium"
                                        style={{ color: faded ? "var(--text2)" : "var(--text)" }}
                                    >
                                        {r.title}
                                    </span>
                                </span>
                                <span
                                    className="flex-none rounded-md border px-1.75 text-[11px] font-semibold"
                                    style={statusStyle(r.status)}
                                >
                                    {r.status}
                                </span>
                                <span className="w-13.5 flex-none text-right font-mono text-[11px] text-(--muted)">
                                    {r.date}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* by category + add */}
                <div className="flex flex-col gap-3.25">
                    <div className="rounded-[13px] border border-(--border) bg-(--surface) px-4 py-3.5">
                        <div className="mb-3 text-[13px] font-semibold">By category</div>
                        <div className="flex flex-col gap-2.5">
                            {BY_CATEGORY.map((c) => (
                                <button
                                    key={c.name}
                                    onClick={() => navigate("/browse")}
                                    className="flex w-full cursor-pointer items-center gap-2.5"
                                >
                                    <span className="w-24 flex-none truncate text-left text-[12.5px] text-(--text2)">
                                        {c.name}
                                    </span>
                                    <span className="h-1.75 flex-1 overflow-hidden rounded-[4px] bg-(--line)">
                                        <span
                                            className="block h-full bg-(--accent)"
                                            style={{ width: `${Math.round((c.count / catMax) * 100)}%` }}
                                        />
                                    </span>
                                    <span className="w-5 flex-none text-right font-mono text-[11.5px] text-(--muted)">
                                        {c.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => navigate("/add")}
                        className="flex cursor-pointer items-center gap-3 rounded-[13px] border border-dashed border-(--border) bg-(--surface) px-4 py-3.75 text-left"
                    >
                        <span className="flex size-8.5 flex-none items-center justify-center rounded-[9px] border border-(--border) text-[19px] text-(--accent)">
                            +
                        </span>
                        <span>
                            <span className="block text-[13.5px] font-semibold text-(--text)">
                                Add a memory
                            </span>
                            <span className="mt-px block text-[12px] text-(--text2)">
                                Create one directly as active
                            </span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Home;
