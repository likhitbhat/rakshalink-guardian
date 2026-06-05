import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Phone, Mic, MapPin, Volume2, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveLocation } from "@/lib/use-live-location";
import { sendEmergencySms } from "@/lib/sms.functions";
import { notifyGuardians } from "@/lib/push.functions";
import { useOnlineStatus, queueOfflineAlert, cacheLastLocation } from "@/lib/offline";
import { sosConfirmBeep, sosButtonTap } from "@/lib/feedback";
import { SosActiveScreen } from "@/components/SosActiveScreen";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sos")({
  head: () => ({
    meta: [
      { title: "SOS Emergency — RakshaLink" },
      { name: "description", content: "Trigger an emergency SOS to instantly alert your guardians with your live location and start audio capture." },
      { property: "og:title", content: "SOS Emergency — RakshaLink" },
      { property: "og:description", content: "One tap to alert guardians with your live location in an emergency." },
      { property: "og:url", content: "https://rakshalink.lovable.app/app/sos" },
    ],
    links: [{ rel: "canonical", href: "https://rakshalink.lovable.app/app/sos" }],
  }),
  component: SosPage,
});

const COOLDOWN_SECONDS = 30;
const AUTO_CONFIRM_SECONDS = 5;

function SosPage() {
  const { user } = useAuth();
  const { loc: liveLoc } = useLiveLocation();
  const liveLocRef = useRef(liveLoc);
  liveLocRef.current = liveLoc;
  const sendSms = useServerFn(sendEmergencySms);
  const pushGuardians = useServerFn(notifyGuardians);
  const online = useOnlineStatus();
  const [holding, setHolding] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [guardianCount, setGuardianCount] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(AUTO_CONFIRM_SECONDS);
  const [falseAlarmFor, setFalseAlarmFor] = useState<string | null>(null);
  const [falseAlarmWarning, setFalseAlarmWarning] = useState(false);
  const [noVerifiedWarn, setNoVerifiedWarn] = useState(false);
  const lastSosAtRef = useRef<number | null>(null);
  const verifiedCountRef = useRef<number>(0);
  const holdRef = useRef<number | null>(null);
  const triggeringRef = useRef(false);

  // Log every SOS trigger attempt (successful or rate-limited)
  function logAttempt(status: "triggered" | "rate_limited", alertId?: string) {
    if (!user) return;
    supabase
      .from("sos_attempts")
      .insert({ user_id: user.id, status, alert_id: alertId ?? null })
      .then(() => undefined);
  }

  // Hold-to-arm countdown — opens the confirmation sheet (instead of firing directly)
  useEffect(() => {
    if (!holding || activeAlert || confirmOpen || cooldownLeft > 0) return;
    setCountdown(3);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    const fire = setTimeout(() => {
      if (triggeringRef.current || activeAlert) return;
      requestSos();
    }, 3000);
    return () => {
      clearInterval(t);
      clearTimeout(fire);
    };
  }, [holding]);

  // Rehydrate any still-active alert + cooldown when the page mounts
  useEffect(() => {
    if (!user) return;
    supabase
      .from("emergency_alerts")
      .select("id, started_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setActiveAlert(data.id);
        setSeconds(Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000));
      });
    supabase
      .from("guardian_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .then(({ count }) => setGuardianCount(count ?? 0));
    supabase
      .from("emergency_contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("verified", true)
      .then(({ count }) => {
        verifiedCountRef.current = count ?? 0;
      });
    supabase
      .from("user_preferences")
      .select("last_sos_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const ts = data?.last_sos_at ? new Date(data.last_sos_at).getTime() : null;
        lastSosAtRef.current = ts;
        if (ts) {
          const left = Math.ceil((COOLDOWN_SECONDS * 1000 - (Date.now() - ts)) / 1000);
          if (left > 0) setCooldownLeft(left);
        }
      });
  }, [user]);

  // Active timer
  useEffect(() => {
    if (!activeAlert) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [activeAlert]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setInterval(() => setCooldownLeft((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  // Auto-confirm countdown while the confirmation sheet is open
  useEffect(() => {
    if (!confirmOpen) return;
    setAutoConfirm(AUTO_CONFIRM_SECONDS);
    const t = setInterval(() => {
      setAutoConfirm((c) => {
        if (c <= 1) {
          clearInterval(t);
          confirmTrigger();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [confirmOpen]);

  async function getFreshLocation(): Promise<{ lat: number; lng: number }> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return liveLocRef.current;
    return new Promise((resolve) => {
      const fallback = setTimeout(() => resolve(liveLocRef.current), 4000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallback);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(fallback);
          resolve(liveLocRef.current);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 4000 },
      );
    });
  }

  // Step 1: a hold completed — enforce cooldown, then open confirmation sheet
  function requestSos() {
    if (!user || activeAlert) return;
    const ts = lastSosAtRef.current;
    const left = ts ? Math.ceil((COOLDOWN_SECONDS * 1000 - (Date.now() - ts)) / 1000) : 0;
    if (left > 0) {
      setCooldownLeft(left);
      logAttempt("rate_limited");
      toast.error(`Please wait ${left}s before sending another SOS`);
      return;
    }
    if (verifiedCountRef.current === 0) {
      setNoVerifiedWarn(true);
      return;
    }
    setConfirmOpen(true);
  }

  // No verified contacts — user chose to continue anyway
  function continueWithoutVerified() {
    setNoVerifiedWarn(false);
    setConfirmOpen(true);
  }

  // Step 2: user (or auto-confirm) confirmed — actually fire
  function confirmTrigger() {
    setConfirmOpen(false);
    if (triggeringRef.current || activeAlert) return;
    triggeringRef.current = true;
    triggerSos();
  }

  async function triggerSos() {
    if (!user) return;
    const loc = await getFreshLocation();
    cacheLastLocation(loc);
    const now = Date.now();
    lastSosAtRef.current = now;
    setCooldownLeft(COOLDOWN_SECONDS);
    supabase.from("user_preferences").upsert(
      { user_id: user.id, last_sos_at: new Date(now).toISOString() },
      { onConflict: "user_id" },
    ).then(() => undefined);

    // Offline: queue the alert locally — OfflineSync flushes it on reconnect.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueOfflineAlert({ type: "sos", lat: loc.lat, lng: loc.lng });
      setActiveAlert("offline-queued");
      setSeconds(0);
      logAttempt("triggered");
      toast.success("Emergency queued offline · will send when connection restores");
      sosConfirmBeep();
      if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200, 100, 400]);
      return;
    }

    const { data, error } = await supabase
      .from("emergency_alerts")
      .insert({ user_id: user.id, type: "sos", status: "active", lat: loc.lat, lng: loc.lng })
      .select("id")
      .single();
    if (error) {
      triggeringRef.current = false;
      return toast.error(error.message);
    }
    setActiveAlert(data.id);
    setSeconds(0);
    logAttempt("triggered", data.id);
    toast.success("Emergency activated · guardians notified");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200, 100, 400]);
    sendSms({ data: { alertId: data.id, alertType: "sos", lat: loc.lat, lng: loc.lng } })
      .then((res) => {
        if (res.sent > 0) toast.success(`SMS sent to ${res.sent}/${res.total} contacts`);
        if (res.failed > 0) toast.error(`${res.failed} SMS failed to deliver`);
        if (res.total === 0) toast("No emergency contacts on file");
      })
      .catch((e) => toast.error(`SMS error: ${e?.message ?? "unknown"}`));
    pushGuardians({
      data: {
        type: "sos",
        title: "🚨 SOS Emergency",
        body: "A RakshaLink wearer triggered an SOS alert. Tap to view.",
        alertId: data.id,
      },
    })
      .then((res) => setGuardianCount(res?.recipients ?? 0))
      .catch(() => undefined);
    await supabase.from("live_locations").insert({ user_id: user.id, lat: loc.lat, lng: loc.lng, battery: 75 });
    holdRef.current = window.setInterval(async () => {
      const l = liveLocRef.current;
      await supabase.from("live_locations").insert({ user_id: user.id, lat: l.lat, lng: l.lng, battery: 75 });
    }, 5000);
  }

  async function cancel() {
    if (!activeAlert) return;
    const resolvedId = activeAlert;
    if (resolvedId !== "offline-queued") {
      await supabase.from("emergency_alerts").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", resolvedId);
    }
    if (holdRef.current) clearInterval(holdRef.current);
    triggeringRef.current = false;
    setActiveAlert(null);
    setSeconds(0);
    toast("Emergency cancelled");
    if (resolvedId !== "offline-queued") setFalseAlarmFor(resolvedId);
  }

  async function markFalseAlarm(isFalse: boolean) {
    const id = falseAlarmFor;
    setFalseAlarmFor(null);
    if (!isFalse || !id || !user) return;
    await supabase
      .from("emergency_alerts")
      .update({ notes: `false_alarm: reported by wearer at ${new Date().toISOString()}` })
      .eq("id", id);
    // Increment lifetime false-alarm count on the profile
    const { data: prof } = await supabase
      .from("profiles")
      .select("false_alarm_count")
      .eq("id", user.id)
      .maybeSingle();
    const nextCount = (prof?.false_alarm_count ?? 0) + 1;
    await supabase.from("profiles").update({ false_alarm_count: nextCount }).eq("id", user.id);
    toast("Logged as a false alarm");
    // Warn if 3+ false alarms in the last 24 hours
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from("emergency_alerts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .ilike("notes", "false_alarm%")
      .gte("started_at", since);
    if ((count ?? 0) >= 3) setFalseAlarmWarning(true);
  }

  if (activeAlert) {
    return (
      <SosActiveScreen startSeconds={seconds} guardianCount={guardianCount} onCancel={cancel} />
    );
  }

  const onCooldown = cooldownLeft > 0;

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-between px-6 pt-10">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">SOS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Press & hold to alert your guardians</p>
        {!online && (
          <p className="mt-2 text-xs font-semibold text-primary">
            Offline — SMS will be sent when connection restores
          </p>
        )}
        {onCooldown && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Cooldown · {cooldownLeft}s
          </p>
        )}
      </div>

      <div className="relative flex h-72 w-72 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute inset-6 rounded-full border border-primary/20" />
        <div className="absolute inset-12 rounded-full border border-primary/10" />
        {!holding && !onCooldown && <div className="pulse-ring absolute inset-16 rounded-full" />}
        <button
          disabled={onCooldown}
          onPointerDown={() => !onCooldown && setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          className={`relative flex h-44 w-44 select-none items-center justify-center rounded-full text-primary-foreground transition active:scale-95 ${
            onCooldown
              ? "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
              : "bg-gradient-to-br from-primary to-[oklch(0.42_0.22_15)] shadow-[var(--shadow-glow-red)]"
          }`}
        >
          {onCooldown ? (
            <div className="text-center">
              <span className="font-display text-5xl font-bold tabular-nums">{cooldownLeft}</span>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest">Cooldown</p>
            </div>
          ) : holding ? (
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

      {/* No verified contacts warning */}
      <Drawer open={noVerifiedWarn} onOpenChange={(o) => !o && setNoVerifiedWarn(false)}>
        <DrawerContent>
          <DrawerHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DrawerTitle className="text-center text-xl">No verified contacts</DrawerTitle>
            <DrawerDescription className="text-center">
              No verified contacts — SMS may not reach anyone. Continue anyway?
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <button
              onClick={continueWithoutVerified}
              className="w-full rounded-xl bg-primary py-3.5 text-base font-bold uppercase tracking-wide text-primary-foreground shadow-[var(--shadow-glow-red)]"
            >
              Continue anyway
            </button>
            <button
              onClick={() => setNoVerifiedWarn(false)}
              className="w-full rounded-xl bg-secondary py-3 text-sm font-semibold text-secondary-foreground"
            >
              Cancel
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>



      {/* Confirmation bottom sheet with 5s auto-confirm */}
      <Drawer open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center text-xl">Send SOS Alert?</DrawerTitle>
            <DrawerDescription className="text-center">
              This will notify all your guardians and emergency contacts
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2 text-center text-xs text-muted-foreground">
            Auto-sending in <span className="font-bold text-primary tabular-nums">{autoConfirm}s</span>
          </div>
          <DrawerFooter>
            <button
              onClick={confirmTrigger}
              className="w-full rounded-xl bg-primary py-3.5 text-base font-bold uppercase tracking-wide text-primary-foreground shadow-[var(--shadow-glow-red)]"
            >
              Send Now
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="w-full rounded-xl bg-secondary py-3 text-sm font-semibold text-secondary-foreground"
            >
              Cancel
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* False alarm prompt after resolving */}
      <Drawer open={!!falseAlarmFor} onOpenChange={(o) => !o && setFalseAlarmFor(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center text-xl">Was this a false alarm?</DrawerTitle>
            <DrawerDescription className="text-center">
              Help your guardians by letting them know if this alert was not a real emergency.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <button
              onClick={() => markFalseAlarm(true)}
              className="w-full rounded-xl bg-secondary py-3 text-sm font-semibold text-secondary-foreground"
            >
              Yes, false alarm
            </button>
            <button
              onClick={() => markFalseAlarm(false)}
              className="w-full rounded-xl border border-border py-3 text-sm font-semibold"
            >
              No, it was real
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Repeated false-alarm warning */}
      <Drawer open={falseAlarmWarning} onOpenChange={(o) => !o && setFalseAlarmWarning(false)}>
        <DrawerContent>
          <DrawerHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DrawerTitle className="text-center text-xl">Frequent false alarms</DrawerTitle>
            <DrawerDescription className="text-center">
              You've reported 3 or more false alarms in the last 24 hours. Repeated false alarms can
              reduce your guardians' trust in real emergencies — please use SOS only when needed.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <button
              onClick={() => setFalseAlarmWarning(false)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              I understand
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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
