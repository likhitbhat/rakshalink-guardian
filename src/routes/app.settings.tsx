import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { User, Bell, Shield, Phone, History, MapPin, LogOut, ChevronRight, Moon, Globe, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, signOut } = useAuth();
  const nav = useNavigate();
  const accountId = user?.id ?? profile?.id ?? "";

  const copyId = async () => {
    if (!accountId) return;
    try {
      await navigator.clipboard.writeText(accountId);
      toast.success("Account ID copied", { description: "Share it with your Guardian to link." });
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  };

  const groups = [
    {
      title: "Safety",
      items: [
        { icon: Phone, label: "Emergency contacts", to: "/app/contacts" },
        { icon: MapPin, label: "Safe zones", to: "/app/zones" },
        { icon: History, label: "Emergency history", to: "/app/history" },
      ],
    },
    {
      title: "Preferences",
      items: [
        { icon: Bell, label: "Notifications", to: "/app/settings" },
        { icon: Moon, label: "Theme · Dark", to: "/app/settings" },
        { icon: Globe, label: "Language · English", to: "/app/settings" },
        { icon: Shield, label: "Privacy", to: "/app/settings" },
      ],
    },
  ];

  return (
    <div className="px-5 pt-8">
      <div className="glass-strong flex items-center gap-4 rounded-3xl p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-primary/30 font-display text-xl font-bold">
          {(profile?.full_name?.[0] ?? "U").toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold">{profile?.full_name ?? "User"}</p>
          <p className="text-xs capitalize text-muted-foreground">{profile?.role ?? "user"}</p>
        </div>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success">Active</span>
      </div>

      {groups.map((g) => (
        <div key={g.title} className="mt-6">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
          <div className="glass divide-y divide-border/40 overflow-hidden rounded-2xl">
            {g.items.map((it) => (
              <Link key={it.label} to={it.to as any} className="flex items-center gap-3 px-4 py-3.5">
                <it.icon className="h-4 w-4 text-accent" />
                <span className="flex-1 text-sm">{it.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={async () => {
          await signOut();
          nav({ to: "/" });
        }}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 py-3.5 text-sm font-semibold text-primary"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">RakshaLink v1.0 · Demo build</p>
    </div>
  );
}
