import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Phone, Trash2, User } from "lucide-react";
import { SkeletonAvatar, Skeleton, SkeletonBadge } from "@/components/ui/skeleton";
import { ErrorCard, EmptyState } from "@/components/StateCards";
import { useMinLoading } from "@/lib/use-min-loading";
import { toast } from "sonner";


export const Route = createFileRoute("/app/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", relation: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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

  async function add() {
    if (!user || !form.name || !form.phone) return;
    const raw = form.phone.trim();
    const parsed = raw.startsWith("+")
      ? parsePhoneNumberFromString(raw)
      : parsePhoneNumberFromString(raw, "IN");
    if (!parsed || !parsed.isValid()) {
      return toast.error("Invalid phone number. Use +<country code><number> for international.");
    }
    const payload = { ...form, phone: parsed.number, user_id: user.id };
    const { error } = await supabase.from("emergency_contacts").insert(payload);
    if (error) return toast.error(error.message);
    setAdding(false);
    setForm({ name: "", phone: "", relation: "" });
    toast.success(`Contact added (${parsed.country ?? "INTL"})`);
    load();
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
        {contacts.map((c) => (
          <div key={c.id} className="glass flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-[11px] text-muted-foreground">{c.phone} {c.relation && `· ${c.relation}`}</p>
            </div>
            <a href={`tel:${c.phone}`} className="text-accent">
              <Phone className="h-4 w-4" />
            </a>
            <button
              onClick={async () => {
                await supabase.from("emergency_contacts").delete().eq("id", c.id);
                load();
              }}
              className="text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

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
    </div>
  );
}
