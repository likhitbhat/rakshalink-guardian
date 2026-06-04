import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { sendContactVerificationSms } from "@/lib/contact-verify.functions";
import { Plus, Phone, Trash2, User, Send, BadgeCheck, ShieldQuestion, Star } from "lucide-react";
import { SkeletonAvatar, Skeleton, SkeletonBadge } from "@/components/ui/skeleton";
import { ErrorCard, EmptyState } from "@/components/StateCards";
import { useMinLoading } from "@/lib/use-min-loading";
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
import { toast } from "sonner";


export const Route = createFileRoute("/app/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const { user } = useAuth();
  const sendVerify = useServerFn(sendContactVerificationSms);
  const [contacts, setContacts] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", relation: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const showSkeleton = useMinLoading(loading);

  async function load() {
    if (!user) return;
    setLoadError(false);
    const { data, error } = await supabase.from("emergency_contacts").select("*").eq("user_id", user.id).order("created_at");
    if (error) setLoadError(true);
    setContacts(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [user]);

  async function sendVerification(contactId: string, silent = false) {
    setBusyId(contactId);
    try {
      const res = await sendVerify({ data: { contactId } });
      if (res.status === "sent") toast.success("Verification SMS sent");
      else toast.error(`SMS failed: ${res.error ?? "unknown"}`);
    } catch (e: any) {
      toast.error(`SMS error: ${e?.message ?? "unknown"}`);
    } finally {
      setBusyId(null);
      load();
    }
  }

  async function add() {
    if (!user || !form.name || !form.phone) return;
    const raw = form.phone.trim();
    const parsed = raw.startsWith("+")
      ? parsePhoneNumberFromString(raw)
      : parsePhoneNumberFromString(raw, "IN");
    if (!parsed || !parsed.isValid()) {
      return toast.error("Invalid phone number. Use +<country code><number> for international.");
    }
    const payload = { ...form, phone: parsed.number, user_id: user.id, verified: false };
    const { data: inserted, error } = await supabase
      .from("emergency_contacts")
      .insert(payload)
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setAdding(false);
    setForm({ name: "", phone: "", relation: "" });
    toast.success(`Contact added (${parsed.country ?? "INTL"}) · sending verification SMS`);
    await load();
    if (inserted?.id) sendVerification(inserted.id, true);
  }

  async function markVerified(c: any) {
    setBusyId(c.id);
    const { error } = await supabase
      .from("emergency_contacts")
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq("id", c.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`${c.name} verified`);
    load();
  }

  async function makePrimary(c: any) {
    if (!c.verified) {
      return toast.error("Only verified contacts can be set as primary");
    }
    if (!user) return;
    await supabase.from("emergency_contacts").update({ is_primary: false }).eq("user_id", user.id);
    const { error } = await supabase.from("emergency_contacts").update({ is_primary: true }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(`${c.name} set as primary contact`);
    load();
  }

  async function confirmDelete() {
    const id = deleteId;
    setDeleteId(null);
    if (!id) return;
    const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast("Contact deleted");
    load();
  }

  function smsLabel(status: string | null): string | null {
    if (!status) return null;
    if (status.startsWith("sent")) return "Last SMS: delivered";
    if (status.startsWith("failed")) return `Last SMS: ${status.replace(/^failed:\s*/, "failed — ")}`;
    return `Last SMS: ${status}`;
  }


  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Emergency contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">They'll be alerted when you trigger SOS.</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 space-y-2">
        {showSkeleton ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="glass flex items-center gap-3 rounded-2xl p-4">
              <SkeletonAvatar size={40} />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="mt-1.5 h-2.5 w-36" />
              </div>
              <SkeletonBadge className="w-8" />
            </div>
          ))
        ) : loadError ? (
          <ErrorCard message="Your contacts couldn't load." onRetry={load} />
        ) : (
          <>
        {contacts.length === 0 && !adding && (
          <EmptyState icon={User} title="No contacts yet" message="Add at least one trusted person to be alerted on SOS." />
        )}
        {contacts.map((c) => {
          const sms = smsLabel(c.last_sms_status);
          return (
          <div key={c.id} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  {c.is_primary && (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                      <Star className="h-2.5 w-2.5" /> Primary
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{c.phone} {c.relation && `· ${c.relation}`}</p>
              </div>
              {c.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  <ShieldQuestion className="h-3 w-3" /> Unverified
                </span>
              )}
              <a href={`tel:${c.phone}`} className="text-accent">
                <Phone className="h-4 w-4" />
              </a>
              <button onClick={() => setDeleteId(c.id)} className="text-muted-foreground">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {(sms || c.verified_at) && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                {sms && <span>{sms}</span>}
                {c.verified && c.verified_at && (
                  <span>Verified on {new Date(c.verified_at).toLocaleDateString()}</span>
                )}
              </div>
            )}

            {!c.verified && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => sendVerification(c.id)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                >
                  <Send className="h-3 w-3" /> {busyId === c.id ? "Sending…" : "Resend Verification SMS"}
                </button>
                <button
                  onClick={() => markVerified(c)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-success/15 px-3 py-1.5 text-[11px] font-semibold text-success disabled:opacity-50"
                >
                  <BadgeCheck className="h-3 w-3" /> Mark as Verified
                </button>
              </div>
            )}
            {c.verified && !c.is_primary && (
              <div className="mt-3">
                <button
                  onClick={() => makePrimary(c)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[11px] font-semibold"
                >
                  <Star className="h-3 w-3" /> Set as primary
                </button>
              </div>
            )}
          </div>
          );
        })}
          </>
        )}


        {adding && (
          <div className="glass-strong space-y-2 rounded-2xl p-4">
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm outline-none" />
            <input placeholder="Phone (e.g. 9812345678 or +14155552671)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm outline-none" />
            <input placeholder="Relation (mom, friend...)" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} className="w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm">Cancel</button>
              <button onClick={add} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground">Save</button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be alerted when you trigger SOS. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-primary text-primary-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
