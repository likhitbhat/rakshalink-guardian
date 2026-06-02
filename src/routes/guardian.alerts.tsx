import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Trash2, MapPin, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/guardian/alerts")({
  component: GuardianAlerts,
  validateSearch: (search: Record<string, unknown>): { focus?: string } => ({
    focus: typeof search.focus === "string" ? search.focus : undefined,
  }),
});

function GuardianAlerts() {
  const { user } = useAuth();
  const { focus } = Route.useSearch();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [clearing, setClearing] = useState(false);
  const [wearerIds, setWearerIds] = useState<string[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const addNote = async (alertId: string) => {
    const note = (noteDrafts[alertId] ?? "").trim();
    if (!note) return;
    setSavingNote(true);
    const { error } = await supabase.rpc("guardian_add_alert_note", {
      _alert_id: alertId,
      _note: note,
    });
    setSavingNote(false);
    if (error) {
      toast.error("Failed to add note");
      return;
    }
    setNoteDrafts((d) => ({ ...d, [alertId]: "" }));
    setOpenNote(null);
    load();
    toast.success("Note added");
  };


  async function load() {
    if (!user) return;
    const { data: links } = await supabase.from("guardian_links").select("user_id").eq("guardian_id", user.id).eq("status", "active");
    const ids = (links ?? []).map((l: any) => l.user_id);
    setWearerIds(ids);
    if (!ids.length) return setAlerts([]);
    const { data } = await supabase
      .from("emergency_alerts")
      .select("*")
      .in("user_id", ids)
      .eq("hidden_by_guardian", false)
      .order("started_at", { ascending: false })
      .limit(50);
    setAlerts(data ?? []);
    const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const m: Record<string, string> = {};
    (ps ?? []).forEach((p: any) => (m[p.id] = p.full_name ?? "User"));
    setNames(m);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("guardian-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_alerts" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // When opened from a push notification (?focus=<id>), scroll to and briefly
  // highlight the referenced alert once it's present in the feed.
  useEffect(() => {
    if (!focus || !alerts.some((a) => a.id === focus)) return;
    setHighlightId(focus);
    const el = cardRefs.current[focus];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightId(null), 3500);
    return () => clearTimeout(t);
  }, [focus, alerts]);



  const clearHistory = async () => {
    if (!user || !wearerIds.length) return;
    setClearing(true);
    for (const uid of wearerIds) {
      await supabase.rpc("hide_all_alerts_for_guardian", { _user_id: uid });
    }
    setClearing(false);
    setAlerts([]);
    toast.success("History cleared from your dashboard");
  };

  return (
    <div className="px-5 pt-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live emergency feed for everyone you watch.</p>
        </div>
        {alerts.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear alerts from your dashboard?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes these alerts from your guardian view only. The wearer keeps their own
                  history. This cannot be undone for your dashboard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearHistory} disabled={clearing}>
                  {clearing ? "Clearing…" : "Clear all"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {alerts.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            All quiet — no alerts to show.
          </div>
        )}
        {alerts.map((a) => (
          <div
            key={a.id}
            ref={(el) => {
              cardRefs.current[a.id] = el;
            }}
            className={`glass flex items-start gap-3 rounded-2xl p-4 transition-all ${
              highlightId === a.id
                ? "ring-2 ring-accent shadow-lg shadow-accent/20"
                : a.status === "active"
                  ? "border-primary/50 bg-primary/10"
                  : ""
            }`}
          >

            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${a.status === "active" ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {names[a.user_id] ?? "User"} · <span className="capitalize">{a.type}</span>
                </p>
                <StatusBadge variant={a.status === "active" ? "danger" : "muted"} pulse={a.status === "active"}>
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
                  className="mt-1 inline-flex items-center gap-1 text-xs text-accent underline-offset-2 hover:underline"
                >
                  <MapPin className="h-3 w-3" /> {a.lat.toFixed(4)}, {a.lng.toFixed(4)} · Live location
                </a>
              )}
              {openNote === a.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={noteDrafts[a.id] ?? ""}
                    onChange={(e) => setNoteDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                    placeholder="Add a note for this alert…"
                    className="min-h-[64px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => addNote(a.id)} disabled={savingNote}>
                      {savingNote ? "Saving…" : "Save note"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOpenNote(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5"
                  onClick={() => setOpenNote(a.id)}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" /> Add note
                </Button>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
