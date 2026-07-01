// Date formatting shared across pages.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06-24 14:02" -> "Jun 24, 14:02"; null/empty -> "—". */
export function fmt(s: string | null): string {
    if (!s) return "—";
    const [d, t] = s.split(" ");
    const [, mo, day] = d.split("-");
    return `${MONTHS[Number(mo) - 1]} ${Number(day)}${t ? `, ${t.slice(0, 5)}` : ""}`;
}

/** Date only: "2026-06-24 14:02" -> "Jun 24". */
export function fmtDate(s: string | null): string {
    return fmt(s).replace(/,.*$/, "");
}
