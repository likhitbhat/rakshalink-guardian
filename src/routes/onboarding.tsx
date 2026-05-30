import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getMockLocation } from "@/lib/mock-location";
import { toast } from "sonner";
import {
  Shield,
  User,
  Phone,
  Users,
  Loader2,
  ArrowRight,
  Check,
  MapPin,
  Crosshair,
  Home,
} from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({ meta: [{ title: "Get started — RakshaLink" }] }),
});

type Role = "user" | "guardian";

function getCurrentPositionAsync(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("user");

  const [contact, setContact] = useState({ name: "", phone: "", relation: "" });
  const [zone, setZone] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Redirect guards: must be signed in; skip if already onboarded.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth/login" });
      return;
    }
    if (profile?.full_name && profile?.phone) {
      nav({ to: profile.role === "guardian" ? "/guardian" : "/app" });
    }
  }, [loading, user, profile, nav]);

  // Prefill from profile (e.g. Google name).
  useEffect(() => {
    if (profile?.full_name && !name) setName(profile.full_name);
  }, [profile]);

  const totalSteps = role === "guardian" ? 2 : 4;
  const progress = Math.round((step / totalSteps) * 100);

  function validPhone(raw: string) {
    const v = raw.trim();
    const parsed = v.startsWith("+") ? parsePhoneNumberFromString(v) : parsePhoneNumberFromString(v, "IN");
    return parsed && parsed.isValid() ? parsed.number : null;
  }

  async function saveProfileBasics() {
    if (!user) return;
    if (!name.trim()) return toast.error("Enter your full name");
    const normalized = validPhone(phone);
    if (!normalized) return toast.error("Invalid phone number. Use +<country code><number> for international.");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: normalized })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep(2);
  }

  async function saveRole() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    if (role === "guardian") {
      await finish("guardian");
    } else {
      setStep(3);
    }
  }

  async function saveContact() {
    if (!user) return;
    const normalized = validPhone(contact.phone);
    if (!contact.name.trim() || !normalized) {
      return toast.error("Enter a name and a valid phone number");
    }
    setBusy(true);
    const { error } = await supabase.from("emergency_contacts").insert({
      user_id: user.id,
      name: contact.name.trim(),
      phone: normalized,
      relation: contact.relation.trim() || null,
      is_primary: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Emergency contact added");
    setStep(4);
  }

  async function useMyLocation() {
    setLocating(true);
    const loc = (await getCurrentPositionAsync()) ?? getMockLocation();
    setLocating(false);
    setZone({ name: zone?.name || "Home", lat: loc.lat, lng: loc.lng });
  }

  async function saveZone() {
    if (!user || !zone) return;
    if (!zone.name.trim()) return toast.error("Give the zone a name");
    setBusy(true);
    const { error } = await supabase.from("safe_zones").insert({
      user_id: user.id,
      name: zone.name.trim(),
      type: "home" as any,
      lat: zone.lat,
      lng: zone.lng,
      radius_m: 200,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Safe zone added");
    await finish("user");
  }

  async function finish(r: Role) {
    await refreshProfile();
    nav({ to: r === "guardian" ? "/guardian" : "/app" });
  }

  const stepLabels = useMemo(
    () => (role === "guardian" ? ["Profile", "Role"] : ["Profile", "Role", "Contact", "Safe zone"]),
    [role],
  );

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Shield className="h-10 w-10 animate-pulse text-accent" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-accent">
        <Shield className="h-5 w-5" />
        <span className="font-display font-semibold">RakshaLink</span>
      </div>

      {/* Progress indicator */}
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span>
          Step {step} of {totalSteps}
        </span>
        <span>{stepLabels[step - 1]}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-card">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-8">
        {step === 1 && (
          <Section title="Tell us about you" subtitle="This helps your guardians reach you.">
            <Field icon={User} placeholder="Full name" value={name} onChange={setName} />
            <Field icon={Phone} placeholder="Phone (+countrycode...)" value={phone} onChange={setPhone} />
            <PrimaryButton busy={busy} onClick={saveProfileBasics}>
              Continue <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </Section>
        )}

        {step === 2 && (
          <Section title="How will you use RakshaLink?" subtitle="Choose your role.">
            <div className="grid grid-cols-2 gap-3">
              {(["user", "guardian"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    role === r ? "border-accent bg-accent/10" : "border-border bg-card/40"
                  }`}
                >
                  {r === "user" ? (
                    <Shield className="mb-2 h-5 w-5 text-primary" />
                  ) : (
                    <Users className="mb-2 h-5 w-5 text-accent" />
                  )}
                  <p className="text-sm font-semibold capitalize">{r === "user" ? "Wearer" : "Guardian"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r === "user" ? "I wear the pendant" : "I monitor someone"}
                  </p>
                </button>
              ))}
            </div>
            <PrimaryButton busy={busy} onClick={saveRole}>
              {role === "guardian" ? "Finish" : "Continue"} <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </Section>
        )}

        {step === 3 && (
          <Section title="Add an emergency contact" subtitle="They'll be alerted when you trigger SOS.">
            <Field icon={User} placeholder="Contact name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} />
            <Field icon={Phone} placeholder="Phone (+countrycode...)" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} />
            <Field icon={Users} placeholder="Relation (optional)" value={contact.relation} onChange={(v) => setContact({ ...contact, relation: v })} />
            <PrimaryButton busy={busy} onClick={saveContact}>
              Add contact <Check className="h-4 w-4" />
            </PrimaryButton>
            <SkipButton onClick={() => setStep(4)}>Skip for now</SkipButton>
          </Section>
        )}

        {step === 4 && (
          <Section title="Set your home safe zone" subtitle="We'll relax tracking when you're safe at home.">
            <Field icon={Home} placeholder="Zone name (e.g. Home)" value={zone?.name ?? ""} onChange={(v) => setZone({ name: v, lat: zone?.lat ?? 0, lng: zone?.lng ?? 0 })} />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card/50 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              {zone && zone.lat ? "Location set ✓ — retake" : "Use my current location"}
            </button>
            {zone && zone.lat !== 0 && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" /> {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
              </p>
            )}
            <PrimaryButton busy={busy} onClick={saveZone} disabled={!zone || zone.lat === 0}>
              Finish setup <Check className="h-4 w-4" />
            </PrimaryButton>
            <SkipButton onClick={() => finish("user")}>Skip for now</SkipButton>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  icon: Icon,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 focus-within:border-accent/50">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function PrimaryButton({
  busy,
  onClick,
  disabled,
  children,
}: {
  busy?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-4 font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] disabled:opacity-60"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function SkipButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="w-full py-2 text-center text-sm font-semibold text-muted-foreground">
      {children}
    </button>
  );
}
