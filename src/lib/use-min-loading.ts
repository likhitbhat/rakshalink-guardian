import { useEffect, useRef, useState } from "react";

/**
 * Keeps a loading flag `true` for at least `minMs` to avoid skeleton flicker.
 * - Turns true immediately when `loading` becomes true.
 * - Stays true for the remainder of `minMs` after `loading` becomes false.
 */
export function useMinLoading(loading: boolean, minMs = 300): boolean {
  const [shown, setShown] = useState(loading);
  const startedAt = useRef<number>(loading ? Date.now() : 0);

  useEffect(() => {
    if (loading) {
      startedAt.current = Date.now();
      setShown(true);
      return;
    }
    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, minMs - elapsed);
    if (remaining === 0) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(false), remaining);
    return () => clearTimeout(t);
  }, [loading, minMs]);

  return shown;
}
