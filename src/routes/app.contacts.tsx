import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Phone, Trash2, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", relation: "" });

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("emergency_contacts").select("*").eq("user_id", user.id).order("created_at");
    setContacts(data ?? []);
  }
  useEffect(() => {
    load();
  }, [user]);

  async function add() {
    if (!user || !form.name || !form.phone) return;
    const { error } = await supabase.from("emergency_contacts").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setAdding(false);
    setForm({ name: "", phone: "", relation: "" });
    toast.success("Contact added");
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
        {contacts.length === 0 && !adding && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No contacts yet. Add at least one trusted person.
          </div>
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
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm outline-none" />
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
