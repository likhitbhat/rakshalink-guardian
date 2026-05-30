import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bluetooth, Battery, Signal, RefreshCw, CheckCircle2, Loader2, Cpu, Activity, ShieldAlert, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useFallDetection } from "@/lib/fall-detection";
import { toast } from "sonner";

export const Route = createFileRoute("/app/device")({
  component: DevicePage,
});

const FAKE_DEVICES = [
  { id: "RL-A1B2", name: "RakshaLink Pendant", rssi: -54 },
  { id: "RL-X9Y8", name: "RakshaLink Lite", rssi: -71 },
  { id: "BT-Generic", name: "Unknown BLE", rssi: -88 },
];

function DevicePage() {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<typeof FAKE_DEVICES>([]);
  const [paired, setPaired] = useState<{ id: string; name: string; battery: number; signal: number; firmware: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("devices")
      .select("*")
      .eq("user_id", user.id)
      .eq("paired", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPaired({ id: data.mac ?? "RL-A1B2", name: data.name, battery: data.battery, signal: data.signal, firmware: data.firmware ?? "1.0.0" });
      });
  }, [user]);

  async function scan() {
    setScanning(true);
    setDiscovered([]);
    for (const d of FAKE_DEVICES) {
      await new Promise((r) => setTimeout(r, 700));
      setDiscovered((prev) => [...prev, d]);
    }
    setScanning(false);
  }

  async function pair(d: (typeof FAKE_DEVICES)[number]) {
    if (!user) return;
    const { error } = await supabase.from("devices").insert({
      user_id: user.id,
      name: d.name,
      mac: d.id,
      paired: true,
      battery: 78,
      signal: Math.max(0, 100 + d.rssi),
    });
    if (error) return toast.error(error.message);
    setPaired({ id: d.id, name: d.name, battery: 78, signal: Math.max(0, 100 + d.rssi), firmware: "1.0.0" });
    toast.success("Paired with " + d.name);
  }

  async function unpair() {
    if (!user) return;
    await supabase.from("devices").delete().eq("user_id", user.id);
    setPaired(null);
    toast("Unpaired");
  }

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-2xl font-bold">Pendant</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pair and monitor your wearable.</p>

      <FallDetectionCard />


      {paired ? (
        <div className="glass-strong relative mt-6 overflow-hidden rounded-3xl p-6">
          <div className="scanline absolute inset-x-0 h-24" />
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/40 to-primary/30">
              <Cpu className="h-8 w-8 text-accent" />
            </div>
            <div>
              <p className="font-semibold">{paired.name}</p>
              <p className="text-[11px] text-muted-foreground">{paired.id} · firmware {paired.firmware}</p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat icon={Battery} label="Battery" value={paired.battery + "%"} tone="success" />
            <Stat icon={Signal} label="Signal" value={paired.signal + "%"} tone="accent" />
          </div>
          <button
            onClick={unpair}
            className="mt-4 w-full rounded-2xl border border-border bg-background/40 py-3 text-sm font-medium text-muted-foreground"
          >
            Unpair device
          </button>
        </div>
      ) : (
        <div className="glass-strong mt-6 rounded-3xl p-6 text-center">
          <Bluetooth className="mx-auto h-10 w-10 text-accent" />
          <p className="mt-3 font-semibold">No pendant paired</p>
          <p className="text-xs text-muted-foreground">Tap scan to discover nearby pendants.</p>
          <button
            onClick={scan}
            disabled={scanning}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scanning ? "Scanning…" : "Scan for devices"}
          </button>
        </div>
      )}

      {!paired && discovered.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discovered</p>
          {discovered.map((d) => (
            <button
              key={d.id}
              onClick={() => pair(d)}
              className="glass flex w-full items-center gap-3 rounded-2xl p-4 text-left"
            >
              <Bluetooth className="h-5 w-5 text-accent" />
              <div className="flex-1">
                <p className="text-sm font-medium">{d.name}</p>
                <p className="text-[11px] text-muted-foreground">{d.id} · RSSI {d.rssi}</p>
              </div>
              <span className="text-xs font-semibold text-accent">Pair</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: any) {
  const t = tone === "success" ? "text-success" : "text-accent";
  return (
    <div className="rounded-2xl bg-background/40 p-3">
      <Icon className={`mb-2 h-4 w-4 ${t}`} />
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
