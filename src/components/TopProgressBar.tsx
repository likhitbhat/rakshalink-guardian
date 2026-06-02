import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useIsFetching } from "@tanstack/react-query";

/**
 * YouTube-style thin progress bar fixed to the top of the viewport.
 * Activates during route navigation (TanStack Router) and any in-flight
 * TanStack Query fetch. Smoothly ramps to ~90% then completes on settle.
 */
export function TopProgressBar() {
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const fetching = useIsFetching();
  const active = isNavigating || fetching > 0;

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setVisible(true);
      setProgress((p) => (p < 10 ? 10 : p));
      if (!timer.current) {
        timer.current = setInterval(() => {
          setProgress((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) * 0.08)));
        }, 200);
      }
    } else {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      setProgress(100);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [active]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
