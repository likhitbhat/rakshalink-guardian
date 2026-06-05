import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Shield, MapPin, Bell, Bluetooth, Zap, Heart, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/post-auth";
import { ThemeToggle } from "@/lib/theme";
import { useInstallPrompt } from "@/lib/pwa";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RakshaLink — Instant SOS & Safety Network" },
      { name: "description", content: "Wearable safety pendant + app for women & children: one-tap SOS, live GPS tracking, guardian alerts, and safe zones." },
      { property: "og:title", content: "RakshaLink — Instant SOS & Safety Network" },
      { property: "og:description", content: "One-tap SOS, live tracking, guardian alerts, and safe zones from a smart wearable pendant." },
      { property: "og:url", content: "https://rakshalink.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://rakshalink.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "RakshaLink",
          url: "https://rakshalink.lovable.app/",
          logo: "https://rakshalink.lovable.app/icon-192.png",
          description: "IoT-enabled wearable safety pendant and app providing instant SOS, live tracking, and guardian alerts.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "RakshaLink",
          url: "https://rakshalink.lovable.app/",
        }),
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const path = await resolvePostAuthPath(data.session.user.id);
      throw redirect({ to: path });
    }
  },
  component: Landing,
});


function Landing() {
  const { canInstall, promptInstall } = useInstallPrompt();
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-6 pb-10 pt-12">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      {/* Hero pendant */}
      <div className="relative mx-auto mb-8 flex h-56 w-56 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 blur-3xl" />
        <div className="absolute inset-6 animate-float rounded-full border border-accent/30 glass-strong" />
        <div className="absolute inset-12 flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.22_15)] shadow-[var(--shadow-glow-red)]">
          <Shield className="h-14 w-14 text-primary-foreground" strokeWidth={1.5} />
        </div>
        <div className="pulse-ring absolute inset-12 rounded-full" />
      </div>

      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> IoT Safety Network
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight">
          Raksha<span className="text-gradient-cyan">Link</span>
          <span className="sr-only"> — Instant SOS & Safety Network</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The wearable pendant that turns one tap into a guardian alert,
          live GPS, and emergency response — instantly.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {[
          { icon: Zap, label: "Instant SOS", color: "text-primary" },
          { icon: MapPin, label: "Live tracking", color: "text-accent" },
          { icon: Bluetooth, label: "BLE pendant", color: "text-accent" },
          { icon: Heart, label: "Fall detect", color: "text-warning" },
          { icon: Bell, label: "Guardian alerts", color: "text-primary" },
          { icon: Shield, label: "Safe zones", color: "text-success" },
        ].map((f) => (
          <div key={f.label} className="glass rounded-2xl p-4">
            <f.icon className={`mb-2 h-5 w-5 ${f.color}`} />
            <p className="text-sm font-medium">{f.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        <Link
          to="/auth/register"
          className="block w-full rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-4 text-center font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] transition active:scale-[0.98]"
        >
          Activate RakshaLink
        </Link>
        <Link
          to="/auth/login"
          className="block w-full rounded-2xl border border-border bg-card/50 py-4 text-center font-semibold backdrop-blur transition hover:bg-card"
        >
          I already have an account
        </Link>
        {canInstall && (
          <button
            onClick={promptInstall}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 py-4 text-center font-semibold text-accent backdrop-blur transition hover:bg-accent/20"
          >
            <Download className="h-4 w-4" /> Install App
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Demo build — pendant hardware & SMS gateway are simulated.
      </p>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        New here?{" "}
        <Link to="/guide/wearables-vs-apps" className="text-accent underline-offset-2 hover:underline">
          Safety wearables vs apps →
        </Link>
      </p>
    </div>
  );
}
