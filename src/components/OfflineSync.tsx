import { useEffect } from "react";
import { toast } from "sonner";
import { refreshOfflineCache, syncQueuedAlerts } from "@/lib/offline";

/**
 * Background offline coordinator: keeps the localStorage cache fresh while
 * online and flushes any queued offline SOS alerts when the connection
 * restores. Renders nothing.
 */
export function OfflineSync({ userId }: { userId?: string }) {
  useEffect(() => {
    if (!userId) return;

    refreshOfflineCache(userId);

    const onOnline = async () => {
      await refreshOfflineCache(userId);
      const synced = await syncQueuedAlerts(userId);
      if (synced > 0) toast.success(`${synced} offline alert${synced > 1 ? "s" : ""} synced`);
    };

    // Also attempt a sync immediately in case we loaded already online.
    if (typeof navigator !== "undefined" && navigator.onLine) {
      syncQueuedAlerts(userId).then((n) => {
        if (n > 0) toast.success(`${n} offline alert${n > 1 ? "s" : ""} synced`);
      });
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId]);

  return null;
}
