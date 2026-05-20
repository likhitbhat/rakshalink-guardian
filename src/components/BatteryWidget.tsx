import { useEffect, useRef, useState } from "react";
import { Battery, BatteryLow, BatteryWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMockLocation } from "@/lib/mock-location";

type Props = {
  userId: string | undefined;
  /** When true, this widget owns the wearer's pendant and simulates drain + persists updates. */
  isOwn?: boolean;
  /** When true, the wearer is inside a safe zone — slow drain to reflect low-power mode. */
  lowPower?: boolean;
  compact?: boolean;
  className?: string;
};

function timeAgo(iso: string | null) {
  if (!iso) return "just now";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export function BatteryWidget({ userId, isOwn = false, lowPower = false, compact = false, className = "" }: Props) {
  const [battery, setBattery] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const batteryRef = useRef<number | null>(null);
  batteryRef.current = battery;

  // Initial fetch
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("live_locations")
        .select("battery, recorded_at")
        .eq("user_id", userId)
        .not("battery", "is", null)
        .order("recorded_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = data?.[0];
      if (row?.battery != null) {
        setBattery(row.battery);
        setUpdatedAt(row.recorded_at);
      } else if (isOwn) {
        // Seed for a fresh wearer with no readings yet.
        setBattery(92);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isOwn]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`battery-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_locations", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const row = payload.new;
          if (row?.battery != null) {
            setBattery(row.battery);
            setUpdatedAt(row.recorded_at);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  // Wearer: simulate gentle drain and persist every ~30s.
  useEffect(() => {
    if (!isOwn || !userId) return;
    const t = setInterval(() => {
      const current = batteryRef.current ?? 92;
      const next = current <= 8 ? 100 : current - 1; // loop for demo
      const loc = getMockLocation();
      supabase
        .from("live_locations")
        .insert({ user_id: userId, lat: loc.lat, lng: loc.lng, battery: next })
        .then(({ error }) => {
          if (!error) {
            setBattery(next);
            setUpdatedAt(new Date().toISOString());
          }
        });
    }, 30000);
    return () => clearInterval(t);
  }, [isOwn, userId]);

  // Re-render "Xs ago" every 10s
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  const level = battery ?? 0;
  const tone =
    battery == null
      ? { text: "text-muted-foreground", bar: "bg-muted-foreground/40", Icon: Battery, label: "—" }
      : level <= 15
        ? { text: "text-primary", bar: "bg-primary", Icon: BatteryWarning, label: "Critical" }
        : level <= 35
          ? { text: "text-warning", bar: "bg-warning", Icon: BatteryLow, label: "Low" }
          : { text: "text-success", bar: "bg-success", Icon: Battery, label: "Healthy" };
  const Icon = tone.Icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Icon className={`h-3.5 w-3.5 ${tone.text}`} />
        <span className={`text-xs font-semibold ${tone.text}`}>{battery ?? "—"}%</span>
      </div>
    );
  }

  return (
    <div className={`glass rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${tone.text}`} />
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pendant battery</p>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${tone.text}`}>{tone.label}</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={`font-display text-3xl font-bold ${tone.text}`}>{battery ?? "—"}</span>
        <span className="mb-1 text-xs text-muted-foreground">%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40">
        <div
          className={`h-full rounded-full transition-all duration-700 ${tone.bar}`}
          style={{ width: `${Math.max(4, Math.min(100, level))}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Updated {timeAgo(updatedAt)}</p>
    </div>
  );
}
