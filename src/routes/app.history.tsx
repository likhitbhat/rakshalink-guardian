import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Mic, Timer, Activity, Hand, MessageSquare, CheckCircle2, XCircle, Trash2, CalendarClock, Download, FileText, FileSpreadsheet } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton, SkeletonBadge } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/StateCards";
import { useMinLoading } from "@/lib/use-min-loading";
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

type HistoryFilter = "all" | "sos" | "fall" | "active" | "resolved";

function HistoryPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showMonthlyPrompt, setShowMonthlyPrompt] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [resolving, setResolving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const showSkeleton = useMinLoading(loading);

  const markResolved = async (id: string) => {
    if (!user) return;
    setResolving(id);
    const { error } = await supabase
      .from("emergency_alerts")
      .update({ status: "resolved", ended_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    setResolving(null);
    if (error) {
      toast.error("Failed to update alert");
      return;
    }
    load();
    toast.success("Alert marked resolved");
  };

  const load = () => {
    if (!user) return;
    setLoadError(false);
    supabase
      .from("emergency_alerts")
      .select("*")
      .eq("user_id", user.id)
      .eq("hidden_by_owner", false)
      .order("started_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setLoadError(true);
        setAlerts(data ?? []);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // Monthly prompt: if cookie month != current month, suggest clearing
    const last = getCookie(LAST_CLEARED_COOKIE);
    if (last !== currentMonthKey()) setShowMonthlyPrompt(true);
  }, [user]);

  const clearHistory = async () => {
    if (!user) return;
    setClearing(true);
    const { error } = await supabase
      .from("emergency_alerts")
      .update({ hidden_by_owner: true })
      .eq("user_id", user.id);
    setClearing(false);
    if (error) {
      toast.error("Failed to clear history");
      return;
    }
    setCookie(LAST_CLEARED_COOKIE, currentMonthKey());
    setShowMonthlyPrompt(false);
    setAlerts([]);
    toast.success("History cleared");
  };

  const dismissPrompt = () => {
    setCookie(LAST_CLEARED_COOKIE, currentMonthKey());
    setShowMonthlyPrompt(false);
  };

  const buildRows = () =>
    alerts.map((a) => {
      const batches = parseSmsBatches(a.notes);
      const sms = batches
        .flatMap((b) => b.entries.map((e) => `${e.name} (${e.phone}): ${e.status}${e.error ? ` - ${e.error}` : ""}`))
        .join("; ");
      return {
        type: a.type ?? "",
        status: a.status ?? "",
        date: new Date(a.started_at).toLocaleString(),
        location: a.lat != null ? `${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}` : "",
        sms,
      };
    });

  const exportCSV = () => {
    if (alerts.length === 0) return;
    const rows = buildRows();
    const header = ["Type", "Status", "Date", "Location", "SMS delivery"];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      header.map(esc).join(","),
      ...rows.map((r) => [r.type, r.status, r.date, r.location, r.sms].map(esc).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rakshalink-emergency-history-${currentMonthKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const exportPDF = async () => {
    if (alerts.length === 0) return;
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("RakshaLink — Emergency History", 14, 18);
    doc.setFontSize(10);
    doc.text(`Exported ${new Date().toLocaleString()}`, 14, 25);
    const rows = buildRows();
    autoTable(doc, {
      startY: 30,
      head: [["Type", "Status", "Date", "Location", "SMS delivery"]],
      body: rows.map((r) => [r.type, r.status, r.date, r.location, r.sms]),
      styles: { fontSize: 8, cellWidth: "wrap" },
      headStyles: { fillColor: [220, 50, 50] },
      columnStyles: { 4: { cellWidth: 50 } },
    });
    doc.save(`rakshalink-emergency-history-${currentMonthKey()}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <div className="px-5 pt-8 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Emergency history</h1>
          <p className="mt-1 text-sm text-muted-foreground">Timeline of all alerts and responses.</p>
        </div>
        {alerts.length > 0 && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportPDF}>
                  <FileText className="mr-2 h-4 w-4" /> Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCSV}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears every emergency alert from your history view. Your guardians keep
                  their own copy until they clear it themselves. We store a small cookie on this
                  device to remind you next month.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearHistory} disabled={clearing}>
                  {clearing ? "Clearing…" : "Delete all"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        )}
      </div>

      {showMonthlyPrompt && alerts.length > 0 && (
        <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Monthly cleanup</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A new month has started. Clear old emergency records to keep your account tidy?
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="default" onClick={clearHistory} disabled={clearing}>
                  {clearing ? "Clearing…" : "Clear now"}
                </Button>
                <Button size="sm" variant="ghost" onClick={dismissPrompt}>
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ["all", "All"],
            ["sos", "SOS"],
            ["fall", "Fall"],
            ["active", "Active"],
            ["resolved", "Resolved"],
          ] as [HistoryFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === key
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {showSkeleton ? (
          [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="relative pl-8">
              <Skeleton className="absolute left-2 top-3 h-3 w-3 rounded-full" />
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                  <SkeletonBadge />
                </div>
                <Skeleton className="mt-2 h-2.5 w-28" />
                <Skeleton className="mt-2 h-3 w-40" />
                <Skeleton className="mt-3 h-8 w-full rounded-xl" />
              </div>
            </div>
          ))
        ) : loadError ? (
          <ErrorCard message="Your emergency history couldn't load." onRetry={load} />
        ) : (() => {
          const sorted = [...alerts].sort((a, b) => {
            if (a.status === "active" && b.status !== "active") return -1;
            if (b.status === "active" && a.status !== "active") return 1;
            return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
          });
          const filtered = sorted.filter((a) => {
            if (filter === "all") return true;
            if (filter === "active") return a.status === "active";
            if (filter === "resolved") return a.status === "resolved";
            if (filter === "sos") return a.type === "sos" || a.type === "manual";
            if (filter === "fall") return a.type === "fall";
            return true;
          });
          if (filtered.length === 0) {
            return (
              <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                {alerts.length === 0
                  ? "No emergencies recorded. That's a great thing."
                  : "No alerts match this filter."}
              </div>
            );
          }
          return filtered.map((a, i) => {
            const Icon = a.type === "fall" ? Activity : a.type === "voice" ? Mic : a.type === "deadman" ? Timer : a.type === "manual" ? Hand : AlertTriangle;
            const isActive = a.status === "active";
            return (
              <div key={a.id} className="relative pl-8">
                <div className={`absolute left-2 top-3 h-3 w-3 rounded-full ${isActive ? "bg-primary animate-pulse" : "bg-primary"} shadow-[0_0_0_4px_oklch(0.62_0.24_25/0.2)]`} />
                {i < filtered.length - 1 && <div className="absolute left-3 top-6 h-full w-px bg-border" />}
                <div className={`glass rounded-2xl p-4 ${isActive ? "border border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold capitalize">{a.type}</p>
                    </div>
                    <StatusBadge variant={isActive ? "danger" : a.status === "resolved" ? "safe" : "muted"} pulse={isActive}>
                      {a.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(a.started_at).toLocaleString()}
                  </p>
                  {a.lat != null && a.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-accent underline-offset-2 hover:underline"
                    >
                      📍 {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                    </a>
                  )}
                  {isActive && (
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => markResolved(a.id)}
                      disabled={resolving === a.id}
                    >
                      {resolving === a.id ? "Resolving…" : "Mark resolved"}
                    </Button>
                  )}
                  <SmsDeliveryPanel notes={a.notes} />
                </div>
              </div>
            );
          });
        })()}
      </div>

    </div>
  );
}
