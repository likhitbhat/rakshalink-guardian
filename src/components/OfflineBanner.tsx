import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/offline";

/** Fixed red banner shown whenever the device is offline. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="fixed left-1/2 top-0 z-[60] flex w-full max-w-md -translate-x-1/2 items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)]">
      <WifiOff className="h-4 w-4" />
      Offline Mode Active — actions will sync when you reconnect
    </div>
  );
}
