import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Mail, Lock, User, Phone, Loader2, Users } from "lucide-react";

export const Route = createFileRoute("/auth/register")({
  component: RegisterPage,
  head: () => ({ meta: [{ title: "Create account — RakshaLink" }] }),
});

function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [role, setRole] = useState<"user" | "guardian">("user");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: form.name, phone: form.phone, role },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — welcome to RakshaLink");
    nav({ to: role === "guardian" ? "/guardian" : "/app" });
  }

  return (
    <div>
      <Link to="/" className="mb-6 flex items-center gap-2 text-accent">
        <Shield className="h-5 w-5" />
        <span className="font-display font-semibold">RakshaLink</span>
      </Link>
      <h1 className="text-3xl font-bold">Activate your shield</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose how you'll use RakshaLink.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {(["user", "guardian"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-2xl border p-4 text-left transition ${
              role === r ? "border-accent bg-accent/10" : "border-border bg-card/40"
            }`}
          >
            {r === "user" ? <Shield className="mb-2 h-5 w-5 text-primary" /> : <Users className="mb-2 h-5 w-5 text-accent" />}
            <p className="text-sm font-semibold capitalize">{r === "user" ? "Wearer" : "Guardian"}</p>
            <p className="text-[11px] text-muted-foreground">
              {r === "user" ? "I wear the pendant" : "I monitor someone"}
            </p>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <Field icon={User} placeholder="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field icon={Mail} type="email" placeholder="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field icon={Phone} placeholder="Phone (for emergencies)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field icon={Lock} type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-4 font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Have an account?{" "}
        <Link to="/auth/login" className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  icon: Icon,
  type = "text",
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input
        type={type}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
