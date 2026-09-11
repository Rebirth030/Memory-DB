// Small shared presentational bits used across pages.

import { useEffect, useRef, useState } from "react";

/** CSS padlock for secret / sensitive items. */
export function Lock() {
    return (
        <span className="relative inline-block flex-none" style={{ width: 8, height: 7, border: "1.4px solid var(--lockfg)", borderRadius: 1 }}>
            <span className="absolute" style={{ left: 1, top: -4, width: 4, height: 4, border: "1.4px solid var(--lockfg)", borderBottom: "none", borderRadius: "3px 3px 0 0" }} />
        </span>
    );
}

/** Magnifier glyph for the search box. */
export function SearchIcon() {
    return (
        <span className="relative flex-none" style={{ width: 14, height: 14, border: "2px solid var(--muted)", borderRadius: "50%" }}>
            <span className="absolute" style={{ right: -4, bottom: -3, width: 6, height: 2, background: "var(--muted)", transform: "rotate(45deg)", borderRadius: 1 }} />
        </span>
    );
}

/**
 * Text cut to two lines, with a "show more" toggle — shown only when the text
 * really is cut. Whether it overflows is measured on the element itself, so it
 * holds at any window width or font size. Controlled, so a page can also toggle
 * it from the keyboard.
 */
export function ClampedText({ text, open, onToggle, className = "" }: {
    text: string;
    open: boolean;
    onToggle: () => void;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [overflows, setOverflows] = useState(false);

    useEffect(() => {
        const el = ref.current;
        // Only measurable while clamped; while open the last answer stands, so
        // the toggle stays put to collapse it again.
        if (!el || open) return;
        // The observer also fires once right after observe(), before paint.
        const ro = new ResizeObserver(() => setOverflows(el.scrollHeight > el.clientHeight + 1));
        ro.observe(el);
        return () => ro.disconnect();
    }, [text, open]);

    return (
        <div className={className}>
            {/* Collapsed it reads as one flowing preview — kept line breaks would let a
                blank line between paragraphs eat one of the two lines. Opened, the
                paragraphs come back. */}
            <div ref={ref} className={open ? "whitespace-pre-wrap" : "line-clamp-2"}>{text}</div>
            {overflows && (
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    className="mt-1 cursor-pointer text-[12px] font-medium text-(--accent)"
                >
                    {open ? "show less ▴" : "show more ▾"}
                </button>
            )}
        </div>
    );
}
