import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Shield, Phone, History, MapPin, LogOut, ChevronRight, Moon, Sun, Globe, Copy, Users, BellRing, Eye, MapPinned, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { usePreferences, LANGUAGES, type LanguagePref, type Preferences } from "@/lib/preferences";
import { usePushPermission, describePermission } from "@/lib/push-notifications";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/web-push";
import { StatusBadge } from "@/components/StatusBadge";
import { inviteGuardian, listMyGuardians, revokeGuardian } from "@/lib/guardians.functions";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

type LinkedWearer = { user_id: string; full_name: string | null };
type GuardianRow = { id: string; status: string; guardianName: string | null; guardianEmail: string | null };

function SettingsPage() {
  const { profile, user, signOut } = useAuth();
  const nav = useNavigate();
  const { theme, setTheme } = useTheme();
  const { prefs, update } = usePreferences();
  const { permission, request: requestPush, sendTest, supported: pushSupported } = usePushPermission();
  const pushStatus = describePermission(permission);
  const accountId = user?.id ?? profile?.id ?? "";
  const isGuardian = profile?.role === "guardian";
  const [wearers, setWearers] = useState<LinkedWearer[]>([]);

  const inviteFn = useServerFn(inviteGuardian);
  const listGuardiansFn = useServerFn(listMyGuardians);
  const revokeFn = useServerFn(revokeGuardian);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<GuardianRow | null>(null);

  async function loadGuardians() {
    if (isGuardian || !user?.id) return;
    try {
      const rows = await listGuardiansFn();
      setGuardians(rows);
    } catch (e: any) {
      // non-fatal
    }
  }

  useEffect(() => {
    loadGuardians();
  }, [isGuardian, user?.id]);

  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      const res = await inviteFn({ data: { email } });
      let emailSent = false;
      try {
        await sendTransactionalEmail({
          templateName: "guardian-invite",
          recipientEmail: res.guardianEmail,
          idempotencyKey: `guardian-invite-${user?.id ?? ""}-${res.guardianEmail}`,
          templateData: {
            wearerName: res.wearerName,
            acceptUrl: `${window.location.origin}/guardian`,
          },
        });
        emailSent = true;
      } catch {
        // Email delivery is best-effort; the invite still appears in-app.
      }
      toast.success(res.status === "reinvited" ? "Invitation re-sent" : "Invitation sent", {
        description: emailSent
          ? "We emailed your guardian an invite link."
          : "They'll see the invite when they open RakshaLink.",
      });
      setInviteEmail("");
      loadGuardians();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    try {
      await revokeFn({ data: { linkId: revokeTarget.id } });
      toast.success("Guardian access revoked");
      setRevokeTarget(null);
      loadGuardians();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't revoke");
    }
  }

  useEffect(() => {
    if (!isGuardian || !user?.id) return;
    (async () => {
      const { data: links } = await supabase
        .from("guardian_links")
        .select("user_id")
        .eq("guardian_id", user.id)
        .eq("status", "active");
      const ids = (links ?? []).map((l) => l.user_id);
      if (!ids.length) return setWearers([]);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      setWearers((profs ?? []).map((p) => ({ user_id: p.id, full_name: p.full_name })));
    })();
  }, [isGuardian, user?.id]);

  const copyId = async () => {
    if (!accountId) return;
    try {
      await navigator.clipboard.writeText(accountId);
      toast.success("Account ID copied", {
        description: isGuardian ? "Share with support if needed." : "Share it with your Guardian to link.",
      });
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  };

  const primaryGroup = isGuardian
    ? {
        title: "Monitoring",
        items: [
          { icon: Users, label: "Watched wearers", to: "/guardian" as const },
          { icon: MapPinned, label: "Live map", to: "/guardian/map" as const },
          { icon: BellRing, label: "Alert history", to: "/guardian/alerts" as const },
        ],
      }
    : {
        title: "Safety",
        items: [
          { icon: Phone, label: "Emergency contacts", to: "/app/contacts" as const },
          { icon: MapPin, label: "Safe zones", to: "/app/zones" as const },
          { icon: History, label: "Emergency history", to: "/app/history" as const },
        ],
      };

  const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );


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

      {!isGuardian && (
        <div className="mt-6">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guardian pairing</p>
          <div className="glass overflow-hidden rounded-2xl p-4">
            <p className="text-sm font-medium">Your Account ID</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Share this with your Guardian so they can link and monitor you.</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-2.5">
              <code className="flex-1 break-all font-mono text-[11px] leading-relaxed">{accountId || "—"}</code>
              <button
                onClick={copyId}
                className="shrink-0 rounded-lg bg-accent/15 p-2 text-accent hover:bg-accent/25"
                aria-label="Copy account ID"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!isGuardian && (
        <div className="mt-6">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guardians</p>
          <div className="glass overflow-hidden rounded-2xl">
            <div className="divide-y divide-border/40">
              {guardians.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">
                  No guardians yet. Invite someone to monitor your safety.
                </p>
              ) : (
                guardians.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                      {(g.guardianName?.[0] ?? g.guardianEmail?.[0] ?? "G").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{g.guardianName ?? g.guardianEmail ?? "Guardian"}</p>
                      {g.guardianEmail && (
                        <p className="truncate text-[11px] text-muted-foreground">{g.guardianEmail}</p>
                      )}
                    </div>
                    <StatusBadge variant={g.status === "active" ? "safe" : "warn"}>
                      {g.status === "active" ? "Active" : "Pending"}
                    </StatusBadge>
                    <button
                      onClick={() => setRevokeTarget(g)}
                      className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      aria-label="Revoke guardian"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-border/40 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  inputMode="email"
                  placeholder="Guardian's email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !inviting && handleInvite()}
                  className="flex-1 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-sm outline-none"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {inviting ? "Sending…" : "Invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {isGuardian && (
        <div className="mt-6">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked wearers</p>
          <div className="glass divide-y divide-border/40 overflow-hidden rounded-2xl">
            {wearers.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">No wearers linked yet. Ask them to share their Account ID with you.</p>
            ) : (
              wearers.map((w) => (
                <Link
                  key={w.user_id}
                  to="/guardian/zones/$userId"
                  params={{ userId: w.user_id }}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                    {(w.full_name?.[0] ?? "W").toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm">{w.full_name ?? "Wearer"}</span>
                  <span className="text-[11px] text-muted-foreground">Safe zones</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </div>
        </div>
      )}


      <div className="mt-6">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{primaryGroup.title}</p>
        <div className="glass divide-y divide-border/40 overflow-hidden rounded-2xl">
          {primaryGroup.items.map((it) => (
            <Link key={it.label} to={it.to} className="flex items-center gap-3 px-4 py-3.5">
              <it.icon className="h-4 w-4 text-accent" />
              <span className="flex-1 text-sm">{it.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preferences</p>
        <div className="glass divide-y divide-border/40 overflow-hidden rounded-2xl">
          {/* Push notifications */}
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-accent" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm">Push notifications</p>
                  <StatusBadge variant={pushStatus.tone}>{pushStatus.label}</StatusBadge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isGuardian ? "Alerts for SOS, zone events, low battery" : "SOS, safe-zone & device alerts"}
                </p>
              </div>
              <Toggle
                on={prefs.notifications && permission === "granted"}
                onChange={async (v) => {
                  if (v) {
                    if (!pushSupported) {
                      toast.error("Push notifications aren't supported on this device");
                      return;
                    }
                    if (permission === "denied") {
                      toast.error("Notifications are blocked", {
                        description: "Enable them from your browser site settings, then return here.",
                      });
                      return;
                    }
                    const result = permission === "granted" ? "granted" : await requestPush();
                    if (result === "granted") {
                      update("notifications", true);
                      subscribeToPush();
                      sendTest();
                      toast.success("Notifications enabled");
                    } else if (result === "denied") {
                      toast.error("Permission denied");
                    } else {
                      toast.message("Permission dismissed");
                    }
                  } else {
                    update("notifications", false);
                    unsubscribeFromPush();
                    toast.success("Notifications muted");
                  }
                }}
              />
            </div>
            {pushSupported && permission !== "granted" && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">
                  {permission === "denied"
                    ? "Blocked in your browser. Open site settings to allow notifications."
                    : "Allow your browser to send alerts so you don't miss critical events."}
                </p>
                {permission === "default" && (
                  <button
                    onClick={async () => {
                      const r = await requestPush();
                      if (r === "granted") {
                        update("notifications", true);
                        sendTest();
                        toast.success("Notifications enabled");
                      } else if (r === "denied") {
                        toast.error("Permission denied");
                      }
                    }}
                    className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground"
                  >
                    Enable
                  </button>
                )}
              </div>
            )}
            {permission === "granted" && (
              <button
                onClick={() => {
                  const ok = sendTest();
                  if (ok) toast.success("Test notification sent");
                }}
                className="mt-3 w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Send a test notification
              </button>
            )}
            {permission === "granted" && prefs.notifications && (
              <div className="mt-3 space-y-2 rounded-xl border border-border/50 bg-background/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Alert types
                </p>
                {NOTIFY_TYPES.map((t) => (
                  <div key={t.key} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                    </div>
                    <Toggle on={prefs[t.key]} onChange={(v) => update(t.key, v)} />
                  </div>
                ))}
              </div>
            )}
          </div>




          {/* Quiet hours (guardian) or Privacy/share location (wearer) */}
          {isGuardian ? (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Eye className="h-4 w-4 text-accent" />
              <div className="flex-1">
                <p className="text-sm">Quiet hours</p>
                <p className="text-[11px] text-muted-foreground">Silence non-critical pings 10pm–7am</p>
              </div>
              <Toggle
                on={prefs.quietHours}
                onChange={(v) => {
                  update("quietHours", v);
                  toast.success(v ? "Quiet hours on" : "Quiet hours off");
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Shield className="h-4 w-4 text-accent" />
              <div className="flex-1">
                <p className="text-sm">Share live location</p>
                <p className="text-[11px] text-muted-foreground">Let your guardians see your location</p>
              </div>
              <Toggle
                on={prefs.shareLocation}
                onChange={(v) => {
                  update("shareLocation", v);
                  toast.success(v ? "Location sharing on" : "Location sharing paused");
                }}
              />
            </div>
          )}

          {/* Theme */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            {theme === "dark" ? <Moon className="h-4 w-4 text-accent" /> : <Sun className="h-4 w-4 text-accent" />}
            <div className="flex-1">
              <p className="text-sm">Theme</p>
              <p className="text-[11px] capitalize text-muted-foreground">{theme} mode</p>
            </div>
            <div className="flex rounded-full bg-muted/60 p-0.5 text-[11px]">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    toast.success(`Switched to ${t} theme`);
                  }}
                  className={`rounded-full px-3 py-1 capitalize transition ${
                    theme === t ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Globe className="h-4 w-4 text-accent" />
            <div className="flex-1">
              <p className="text-sm">Language</p>
              <p className="text-[11px] text-muted-foreground">App display language</p>
            </div>
            <select
              value={prefs.language}
              onChange={(e) => {
                update("language", e.target.value as LanguagePref);
                toast.success("Language updated");
              }}
              className="rounded-lg border border-border/50 bg-background/60 px-2.5 py-1.5 text-xs"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>


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

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke guardian access?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.guardianName ?? revokeTarget?.guardianEmail ?? "This guardian"} will no longer be
              able to monitor your safety or receive your emergency alerts. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevoke} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
