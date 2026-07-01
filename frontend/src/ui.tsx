// Small shared presentational bits used across pages.

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
