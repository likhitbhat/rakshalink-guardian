import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Phone, X, Mic, MapPin, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveLocation } from "@/lib/use-live-location";
import { sendEmergencySms } from "@/lib/sms.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sos")({
  component: SosPage,
});

function SosPage() {
  const { user } = useAuth();
  const { loc: liveLoc } = useLiveLocation();
  const liveLocRef = useRef(liveLoc);
  liveLocRef.current = liveLoc;
  const sendSms = useServerFn(sendEmergencySms);
  const [holding, setHolding] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const holdRef = useRef<number | null>(null);

  // Hold-to-trigger countdown
  useEffect(() => {
    if (!holding || activeAlert) return;
    setCountdown(3);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          triggerSos();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [holding]);

  // Active timer
  useEffect(() => {
    if (!activeAlert) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [activeAlert]);

  async function triggerSos() {
    if (!user) return;
    const loc = liveLocRef.current;
    const { data, error } = await supabase
      .from("emergency_alerts")
      .insert({ user_id: user.id, type: "sos", status: "active", lat: loc.lat, lng: loc.lng })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setActiveAlert(data.id);
    setSeconds(0);
    toast.success("Emergency activated · guardians notified");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200, 100, 400]);
    // fire SMS to all emergency contacts
    sendSms({ data: { alertId: data.id, alertType: "sos", lat: loc.lat, lng: loc.lng } })
      .then((res) => {
        if (res.sent > 0) toast.success(`SMS sent to ${res.sent}/${res.total} contacts`);
        if (res.failed > 0) toast.error(`${res.failed} SMS failed to deliver`);
        if (res.total === 0) toast("No emergency contacts on file");
      })
      .catch((e) => toast.error(`SMS error: ${e?.message ?? "unknown"}`));
    // simulate live location pings
    holdRef.current = window.setInterval(async () => {
      const l = liveLocRef.current;
      await supabase.from("live_locations").insert({ user_id: user.id, lat: l.lat, lng: l.lng, battery: 75 });
    }, 5000);
  }

  async function cancel() {
    if (!activeAlert) return;
    await supabase.from("emergency_alerts").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", activeAlert);
    if (holdRef.current) clearInterval(holdRef.current);
    setActiveAlert(null);
    setSeconds(0);
    toast("Emergency cancelled");
  }

  if (activeAlert) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-between px-6 pb-32 pt-10">
        <div className="absolute inset-0 -z-10 animate-pulse bg-gradient-to-b from-primary/20 via-transparent to-transparent" />
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
            <span className="h-2 w-2 animate-ping rounded-full bg-primary" /> Emergency active
          </span>
          <h1 className="mt-4 font-display text-5xl font-bold text-primary">{format(seconds)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Guardians notified · live tracking on</p>
        </div>

        <div className="relative flex h-56 w-56 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute inset-4 rounded-full border-2 border-primary/40" />
          <div className="pulse-ring absolute inset-12 rounded-full" />
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.22_15)] shadow-[var(--shadow-glow-red)]">
            <Shield className="h-12 w-12 text-primary-foreground" />
          </div>
        </div>

        <div className="w-full space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <ActionPill icon={Phone} label="Call 100" />
            <ActionPill icon={Mic} label="Recording" />
            <ActionPill icon={MapPin} label="Sharing" />
          </div>
          <button
            onClick={cancel}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 py-4 font-semibold backdrop-blur"
          >
            <X className="h-4 w-4" /> Cancel emergency
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-between px-6 pt-10">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">SOS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Press & hold to alert your guardians</p>
      </div>

      <div className="relative flex h-72 w-72 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute inset-6 rounded-full border border-primary/20" />
        <div className="absolute inset-12 rounded-full border border-primary/10" />
        {!holding && <div className="pulse-ring absolute inset-16 rounded-full" />}
        <button
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          className="relative flex h-44 w-44 select-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.42_0.22_15)] text-primary-foreground shadow-[var(--shadow-glow-red)] transition active:scale-95"
        >
          {holding ? (
            <span className="font-display text-6xl font-bold">{countdown || "!"}</span>
          ) : (
            <div className="text-center">
              <Shield className="mx-auto h-10 w-10" />
              <p className="mt-2 text-sm font-bold uppercase tracking-widest">Hold</p>
            </div>
          )}
        </button>
      </div>

      <div className="w-full space-y-3">
        <div className="glass rounded-2xl p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">When triggered</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Step icon={Phone} text="SMS to contacts" />
            <Step icon={MapPin} text="Live GPS share" />
            <Step icon={Mic} text="Audio recording" />
            <Step icon={Volume2} text="Loud siren" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionPill({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="glass flex flex-col items-center gap-1 rounded-2xl py-3">
      <Icon className="h-4 w-4 text-accent" />
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}
function Step({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-background/40 p-2">
      <Icon className="h-3.5 w-3.5 text-accent" />
      {text}
    </div>
  );
}
function format(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}
