import { useEffect } from "react";

const APP = "memory.db";

/** Sets the browser tab title for the current page, e.g. "Review (3) · memory.db". */
export function useDocumentTitle(title?: string) {
    useEffect(() => {
        document.title = title ? `${title} · ${APP}` : APP;
    }, [title]);
}
