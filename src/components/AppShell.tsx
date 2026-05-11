import { Link, useLocation } from "@tanstack/react-router";
import { Home, MapPin, Shield, Bell, Settings, Bluetooth, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const userNav = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/map", label: "Track", icon: MapPin },
  { to: "/app/sos", label: "SOS", icon: Shield, sos: true },
  { to: "/app/device", label: "Device", icon: Bluetooth },
  { to: "/app/settings", label: "More", icon: Settings },
];
const guardianNav = [
  { to: "/guardian", label: "Watch", icon: Users },
  { to: "/guardian/map", label: "Map", icon: MapPin },
  { to: "/guardian/alerts", label: "Alerts", icon: Bell },
  { to: "/app/settings", label: "More", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const loc = useLocation();
  const nav = profile?.role === "guardian" ? guardianNav : userNav;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-3 pb-3">
        <div className="glass-strong flex items-center justify-around rounded-2xl px-2 py-2 shadow-[var(--shadow-elevated)]">
          {nav.map((item) => {
            const active = loc.pathname === item.to;
            const Icon = item.icon;
            if ("sos" in item && item.sos) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.5_0.22_15)] text-primary-foreground shadow-[var(--shadow-glow-red)] transition active:scale-95"
                  aria-label="SOS"
                >
                  <Icon className="h-6 w-6" />
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition",
                  active ? "text-accent" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_oklch(0.78_0.14_200/0.7)]")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
