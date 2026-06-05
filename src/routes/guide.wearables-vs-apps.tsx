import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Check, X, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/lib/theme";

const CANONICAL = "https://rakshalink.lovable.app/guide/wearables-vs-apps";

const FAQS = [
  {
    q: "Are safety wearables better than phone safety apps?",
    a: "For speed and reliability, yes. A dedicated wearable pendant triggers an SOS in one tap without unlocking a phone, works even when your phone is in a bag, and keeps running on its own battery. Phone apps are convenient and free, but depend on the phone being awake, unlocked, and reachable.",
  },
  {
    q: "Do safety apps work when my phone is locked?",
    a: "Most need the app open or the screen unlocked to trigger reliably. A wearable like RakshaLink sends the alert from the pendant itself, so a locked or pocketed phone is not a barrier.",
  },
  {
    q: "Can a wearable detect a fall automatically?",
    a: "Yes. RakshaLink's pendant uses motion sensing to detect a hard fall and can alert your guardians automatically, even if you can't press the button.",
  },
  {
    q: "Do I still need a phone with a safety wearable?",
    a: "The pendant pairs with the app over Bluetooth to send guardian alerts, share live GPS, and manage safe zones — so you get the best of both: instant hardware triggering plus a rich app experience.",
  },
];

const ROWS: { label: string; wearable: boolean; app: boolean; note: string }[] = [
  { label: "One-tap trigger (no unlock)", wearable: true, app: false, note: "Press a physical button vs. unlock + open app" },
  { label: "Works with phone locked / in bag", wearable: true, app: false, note: "Pendant sends the alert independently" },
  { label: "Automatic fall detection", wearable: true, app: false, note: "Motion sensor on the pendant" },
  { label: "Independent battery", wearable: true, app: false, note: "Runs even if your phone dies" },
  { label: "Discreet activation", wearable: true, app: false, note: "No visible screen tapping" },
  { label: "Live GPS tracking", wearable: true, app: true, note: "Both share location with guardians" },
  { label: "Guardian alerts & safe zones", wearable: true, app: true, note: "App layer powers both" },
  { label: "No extra device to carry", wearable: false, app: true, note: "App-only wins on convenience" },
];

export const Route = createFileRoute("/guide/wearables-vs-apps")({
  head: () => ({
    meta: [
      { title: "Safety Wearables vs Safety Apps | RakshaLink" },
      {
        name: "description",
        content:
          "Compare safety wearables and phone safety apps on speed, reliability, and fall detection — and see which protects you faster in an emergency.",
      },
      { property: "og:title", content: "Safety Wearables vs Safety Apps: Which Protects You Faster?" },
      {
        property: "og:description",
        content:
          "A clear comparison of wearable safety pendants vs phone-only safety apps — trigger speed, locked-phone access, fall detection, and battery independence.",
      },
      { property: "og:url", content: CANONICAL },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Safety Wearables vs Safety Apps: Which Protects You Faster?",
          description:
            "A comparison of wearable safety pendants and phone-only safety apps across trigger speed, reliability, fall detection, and battery independence.",
          author: { "@type": "Organization", name: "RakshaLink" },
          publisher: {
            "@type": "Organization",
            name: "RakshaLink",
            logo: { "@type": "ImageObject", url: "https://rakshalink.lovable.app/icon-192.png" },
          },
          mainEntityOfPage: CANONICAL,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-6 pb-16 pt-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>

      {/* Hero */}
      <header className="mt-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <Shield className="h-3 w-3" /> Safety Guide
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
          Safety Wearables vs Safety Apps:{" "}
          <span className="text-gradient-cyan">Which Protects You Faster?</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          When seconds matter, the difference between a wearable safety pendant and a
          phone-only safety app comes down to one thing: how fast and how reliably you
          can call for help. Here's an honest comparison to help you choose — and how
          RakshaLink combines the strengths of both.
        </p>
      </header>

      {/* Comparison table */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Side-by-side comparison</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border glass">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card/40">
                <th className="px-4 py-3 font-medium">Capability</th>
                <th className="px-3 py-3 text-center font-medium">Wearable</th>
                <th className="px-3 py-3 text-center font-medium">App only</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.note}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {r.wearable ? (
                      <Check className="mx-auto h-4 w-4 text-success" />
                    ) : (
                      <X className="mx-auto h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {r.app ? (
                      <Check className="mx-auto h-4 w-4 text-success" />
                    ) : (
                      <X className="mx-auto h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sections */}
      <section className="mt-10 space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold">When a safety app is enough</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If you mostly want occasional location sharing with family, a check-in timer,
            or a loud alarm you can trigger from your phone, a good safety app covers the
            basics at no extra cost. It's a sensible first step — provided your phone is
            charged, unlocked quickly, and within reach when you need it.
          </p>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">Where wearables win</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            In a real emergency you rarely have time to dig out a phone, unlock it, and
            find an app. A wearable pendant lives on your body and triggers with a single
            press — discreetly, even with the phone locked or buried in a bag. Add
            automatic fall detection and an independent battery, and a wearable keeps
            working in exactly the moments an app can't.
          </p>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">How RakshaLink combines both</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            RakshaLink pairs a one-tap BLE pendant with a full safety app. The pendant
            handles instant, reliable triggering and fall detection; the app handles live
            GPS, guardian alerts, and safe zones. You get hardware-grade speed without
            giving up the rich features only an app can provide — the best of both worlds.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold">Frequently asked questions</h2>
        <div className="mt-4 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-2xl border border-border glass p-4">
              <h3 className="text-sm font-semibold">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-12">
        <Link
          to="/auth/register"
          className="block w-full rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-4 text-center font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] transition active:scale-[0.98]"
        >
          Get protected with RakshaLink
        </Link>
      </div>
    </div>
  );
}
