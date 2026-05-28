import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Mic, Timer, Activity, Hand, MessageSquare, CheckCircle2, XCircle, Trash2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const LAST_CLEARED_COOKIE = "raksha_history_last_cleared";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 400) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type SmsEntry = { name: string; phone: string; status: "sent" | "failed"; error?: string };
type SmsBatch = { timestamp: string; sent: number; failed: number; total: number; entries: SmsEntry[] };

function parseSmsBatches(notes: string | null | undefined): SmsBatch[] {
  if (!notes) return [];
  const batches: SmsBatch[] = [];
  const lines = notes.split("\n");
  let current: SmsBatch | null = null;
  const headerRe = /^\[SMS (.+?)\]\s+(\d+)\/(\d+) delivered,\s+(\d+) failed\.?/;
  const entryRe = /^\s*-\s+(.+?)\s+\((.+?)\):\s+(sent|failed)(?:\s+—\s+(.*))?$/;
  for (const line of lines) {
    const h = line.match(headerRe);
    if (h) {
      if (current) batches.push(current);
      current = { timestamp: h[1], sent: +h[2], total: +h[3], failed: +h[4], entries: [] };
      continue;
    }
    const e = line.match(entryRe);
    if (e && current) {
      current.entries.push({
        name: e[1].trim(),
        phone: e[2].trim(),
        status: e[3] as "sent" | "failed",
        error: e[4]?.trim(),
      });
    }
  }
  if (current) batches.push(current);
  return batches;
}

function SmsDeliveryPanel({ notes }: { notes: string | null | undefined }) {
  const batches = parseSmsBatches(notes);
  if (batches.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-accent" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          SMS delivery
        </p>
      </div>
      <div className="space-y-3">
        {batches.map((b, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {new Date(b.timestamp).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-success">
                  <CheckCircle2 className="h-3 w-3" /> {b.sent} sent
                </span>
                {b.failed > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
                    <XCircle className="h-3 w-3" /> {b.failed} failed
                  </span>
                )}
                <span className="text-muted-foreground">/ {b.total}</span>
              </div>
            </div>
            <ul className="space-y-1">
              {b.entries.map((e, j) => (
                <li
                  key={j}
                  className="flex items-start justify-between gap-2 rounded-lg bg-card/40 px-2 py-1.5 text-[11px]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.name}</p>
                    <p className="truncate text-muted-foreground">{e.phone}</p>
                    {e.status === "failed" && e.error && (
                      <p className="mt-0.5 text-primary/90">Reason: {e.error}</p>
                    )}
                  </div>
                  {e.status === "sent" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-success">
                      <CheckCircle2 className="h-3 w-3" /> Sent
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-primary">
                      <XCircle className="h-3 w-3" /> Failed
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/app/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("emergency_alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .then(({ data }) => setAlerts(data ?? []));
  }, [user]);

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-2xl font-bold">Emergency history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Timeline of all alerts and responses.</p>

      <div className="mt-6 space-y-3">
        {alerts.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No emergencies recorded. That's a great thing.
          </div>
        )}
        {alerts.map((a, i) => {
          const Icon = a.type === "fall" ? Activity : a.type === "voice" ? Mic : a.type === "deadman" ? Timer : a.type === "manual" ? Hand : AlertTriangle;
          return (
            <div key={a.id} className="relative pl-8">
              <div className="absolute left-2 top-3 h-3 w-3 rounded-full bg-primary shadow-[0_0_0_4px_oklch(0.62_0.24_25/0.2)]" />
              {i < alerts.length - 1 && <div className="absolute left-3 top-6 h-full w-px bg-border" />}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold capitalize">{a.type}</p>
                  </div>
                  <StatusBadge variant={a.status === "active" ? "danger" : a.status === "resolved" ? "safe" : "muted"}>
                    {a.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(a.started_at).toLocaleString()}
                </p>
                {a.lat && (
                  <p className="mt-2 text-xs text-accent">
                    📍 {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                  </p>
                )}
                <SmsDeliveryPanel notes={a.notes} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
