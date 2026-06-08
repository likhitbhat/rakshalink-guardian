import { useState, useEffect } from "react";

export function SplashScreen() {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit" | "done">("enter");

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase("hold"), 800);
    const exitTimer = setTimeout(() => setPhase("exit"), 2200);
    const doneTimer = setTimeout(() => setPhase("done"), 3000);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-700 ${
        phase === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="relative flex flex-col items-center gap-6">
        {/* Logo with animated rings */}
        <div className="relative flex items-center justify-center">
          {/* Outer ring pulse */}
          <div
            className={`absolute h-48 w-48 rounded-full border border-primary/20 transition-all duration-700 ${
              phase === "enter" ? "scale-50 opacity-0" : "scale-100 opacity-100"
            }`}
            style={{
              animation: phase !== "enter" ? "splashPulse 2s ease-out infinite" : "none",
            }}
          />
          {/* Middle ring */}
          <div
            className={`absolute h-36 w-36 rounded-full border border-accent/20 transition-all duration-700 delay-100 ${
              phase === "enter" ? "scale-50 opacity-0" : "scale-100 opacity-100"
            }`}
            style={{
              animation: phase !== "enter" ? "splashPulse 2s ease-out 0.4s infinite" : "none",
            }}
          />
          {/* Glow behind logo */}
          <div className="absolute h-28 w-28 rounded-full bg-primary/30 blur-2xl" />
          {/* Logo image */}
          <img
            src="/icon-512.png"
            alt="RakshaLink"
            className={`relative h-24 w-24 object-contain transition-all duration-700 ${
              phase === "enter" ? "scale-0 opacity-0" : "scale-100 opacity-100"
            }`}
            style={{
              filter: "drop-shadow(0 0 20px oklch(0.62 0.24 25 / 0.5))",
            }}
          />
        </div>

        {/* Brand name */}
        <div
          className={`flex flex-col items-center gap-1 transition-all duration-700 delay-200 ${
            phase === "enter" ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Raksha<span className="text-gradient-cyan">Link</span>
          </h1>
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Safety First
          </span>
        </div>
      </div>
    </div>
  );
}
