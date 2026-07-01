import { useEffect, useState } from "react";

interface AsyncState<T> {
    data?: T;
    error?: string;
    loading: boolean;
}

/**
 * Runs `fn` in an effect and tracks its result as { data, error, loading }.
 * Re-runs whenever `deps` changes (same rules as useEffect's dep array).
 *
 * const { data: rows, loading, error } = useAsync(() => searchMemories(filter), [filter]);
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
    const [state, setState] = useState<AsyncState<T>>({ loading: true });

    useEffect(() => {
        let cancelled = false;
        // deferred to a microtask so the reset isn't a *synchronous* setState in the
        // effect body (react-hooks/set-state-in-effect) — runs before fn() resolves either way
        void Promise.resolve().then(() => { if (!cancelled) setState({ loading: true }); });
        fn()
            .then((data) => { if (!cancelled) setState({ data, loading: false }); })
            .catch((e) => { if (!cancelled) setState({ error: (e as Error).message, loading: false }); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps explicitly
    }, deps);

    return state;
}
