import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Mail, Lock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — RakshaLink" }] }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    nav({ to: "/app" });
  }

  return (
    <div>
      <Link to="/" className="mb-6 flex items-center gap-2 text-accent">
        <Shield className="h-5 w-5" />
        <span className="font-display font-semibold">RakshaLink</span>
      </Link>
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your safety network.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} />
        <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} />
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-4 font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/auth/register" className="font-semibold text-accent">
          Create account
        </Link>
      </p>
    </div>
  );
}

function Field({
  icon: Icon,
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 focus-within:border-accent/50">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input
        type={props.type}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
