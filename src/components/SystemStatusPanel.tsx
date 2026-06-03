import { Wifi, WifiOff, Satellite, Radio, Loader2, BatteryFull, BatteryWarning } from "lucide-react";
import { useSystemStatus, type GpsState, type RealtimeState } from "@/lib/system-status";

function Dot({ tone }: { tone: "green" | "yellow" | "red" }) {
  const color =
    tone === "green" ? "bg-success" : tone === "yellow" ? "bg-warning" : "bg-primary";
  return (
    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color} ${tone !== "green" ? "animate-pulse" : ""}`} />
  );
}

const gpsMeta: Record<GpsState, { tone: "green" | "yellow" | "red"; label: string }> = {
  good: { tone: "green", label: "GPS strong" },
  stale: { tone: "yellow", label: "GPS weak" },
  lost: { tone: "red", label: "GPS lost" },
};

const realtimeMeta: Record<RealtimeState, { tone: "green" | "yellow" | "red"; label: string }> = {
  connected: { tone: "green", label: "Live updates on" },
  reconnecting: { tone: "yellow", label: "Reconnecting…" },
  paused: { tone: "yellow", label: "Live updates paused" },
};

/** Compact connectivity badge for the home dashboard header area. */
export function ConnectionBadge() {
  const { online, realtime } = useSystemStatus();
  const tone = !online ? "red" : realtime === "connected" ? "green" : "yellow";
  const label = !online ? "Offline" : realtime === "connected" ? "Online" : "Live paused";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-background/40 px-2.5 py-1 text-[11px] font-medium">
      <Dot tone={tone} />
      {label}
    </span>
  );
}

/**
 * Live system-status panel showing internet, GPS, realtime and phone battery.
 * `detailed` renders an expanded breakdown (used on the device page).
 */
export function SystemStatusPanel({ detailed = false }: { detailed?: boolean }) {
  const { battery, online, gps, realtime } = useSystemStatus();
  const g = gpsMeta[gps];
  const rt = realtimeMeta[realtime];

  const batteryTone: "green" | "yellow" | "red" =
    battery.level == null
      ? "yellow"
      : battery.level < 10 && !battery.charging
        ? "red"
        : battery.level < 20 && !battery.charging
          ? "yellow"
          : "green";

  const rows = [
    {
      icon: online ? Wifi : WifiOff,
      tone: (online ? "green" : "red") as "green" | "yellow" | "red",
      title: "Internet",
      value: online ? "Connected" : "Offline mode",
      spin: false,
    },
    {
      icon: Satellite,
      tone: g.tone,
      title: "GPS signal",
      value: g.label,
      spin: false,
    },
    {
      icon: realtime === "reconnecting" ? Loader2 : Radio,
      tone: rt.tone,
      title: "Live updates",
      value: rt.label,
      spin: realtime === "reconnecting",
    },
    {
      icon: batteryTone === "green" ? BatteryFull : BatteryWarning,
      tone: batteryTone,
      title: "Phone battery",
      value: battery.supported
        ? battery.level != null
          ? `${battery.level}%${battery.charging ? " · charging" : ""}`
          : "Reading…"
        : "Not supported",
      spin: false,
    },
  ];

  if (!detailed) {
    return (
      <div className="glass-strong mt-4 rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            System status
          </p>
          <ConnectionBadge />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title} className="flex items-center gap-2 rounded-2xl bg-background/40 p-3">
                <Icon className={`h-4 w-4 shrink-0 ${r.spin ? "animate-spin" : ""} text-muted-foreground`} />
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-muted-foreground">{r.title}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs font-semibold">
                    <Dot tone={r.tone} />
                    {r.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-strong mt-6 rounded-3xl p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Connectivity & device health
      </p>
      <div className="mt-4 space-y-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.title} className="flex items-center gap-3 rounded-2xl bg-background/40 p-3">
              <Icon className={`h-5 w-5 shrink-0 ${r.spin ? "animate-spin" : ""} text-muted-foreground`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-[11px] text-muted-foreground">{r.value}</p>
              </div>
              <Dot tone={r.tone} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
