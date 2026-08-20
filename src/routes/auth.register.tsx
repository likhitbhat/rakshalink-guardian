import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { resolvePostAuthPath } from "@/lib/post-auth";
import {
  isBackendConfigured,
  isBackendFailure,
  mockPostAuthPath,
  signInMock,
} from "@/lib/mock-auth";
import { toast } from "sonner";
import { Shield, Mail, Lock, User, Phone, Loader2, Users, MailCheck } from "lucide-react";

export const Route = createFileRoute("/auth/register")({
  component: RegisterPage,
  head: () => ({ meta: [{ title: "Create account — RakshaLink" }] }),
});

function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [role, setRole] = useState<"user" | "guardian">("user");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const nav = useNavigate();

  function describeError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes("already registered") || m.includes("already been registered"))
      return "That email is already registered. Try signing in instead.";
    if (m.includes("failed to fetch") || m.includes("network"))
      return "Network error — check your connection and try again.";
    return message;
  }

  function fallbackToMock(reason: string) {
    const s = signInMock(form.email || "demo@rakshalink.app", role);
    toast.success(`Preview mode — signed in as ${role === "guardian" ? "guardian" : "wearer"} (${reason})`);
    nav({ to: mockPostAuthPath(s) });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (!isBackendConfigured()) {
        fallbackToMock("backend not configured");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { full_name: form.name, phone: form.phone, role },
        },
      });
      if (error) {
        if (isBackendFailure(error.message)) {
          fallbackToMock("backend unavailable");
          return;
        }
        toast.error(describeError(error.message));
        return;
      }
      if (!data.session) {
        setSent(true);
        toast.success("Account created — check your email to verify");
        return;
      }
      toast.success("Account created — welcome to RakshaLink");
      const path = data.user ? await resolvePostAuthPath(data.user.id) : "/app";
      nav({ to: path });
    } catch {
      fallbackToMock("backend unavailable");
    } finally {
      setBusy(false);
    }
  }


  async function onGoogle() {
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(describeError(result.error.message ?? "Google sign-in failed"));
        setGoogleBusy(false);
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      const path = data.user ? await resolvePostAuthPath(data.user.id) : "/onboarding";
      nav({ to: path });
    } catch {
      toast.error("Network error — check your connection and try again.");
      setGoogleBusy(false);
    }
  }

  async function resendVerification() {
    if (!form.email) return toast.error("Enter your email first");
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: form.email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setResending(false);
    if (error) return toast.error(describeError(error.message));
    toast.success("Verification email sent — check your inbox");
  }

  if (sent) {
    return (
      <div>
        <Link to="/" className="mb-6 flex items-center gap-2 text-accent">
          <Shield className="h-5 w-5" />
          <span className="font-display font-semibold">RakshaLink</span>
        </Link>
        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
          <MailCheck className="h-8 w-8 text-accent" />
        </div>
        <h1 className="mt-5 text-3xl font-bold">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-semibold text-foreground">{form.email}</span>. Click it to activate
          your account, then sign in.
        </p>
        <button
          type="button"
          onClick={resendVerification}
          disabled={resending}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 py-3.5 text-sm font-semibold text-accent disabled:opacity-60"
        >
          {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
          Resend verification email
        </button>
        <button
          type="button"
          onClick={() => nav({ to: "/auth/login" })}
          className="mt-3 w-full rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-4 font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)]"
        >
          Go to sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <Link to="/" className="mb-6 flex items-center gap-2 text-accent">
        <Shield className="h-5 w-5" />
        <span className="font-display font-semibold">RakshaLink</span>
      </Link>
      <h1 className="text-3xl font-bold">Activate your shield</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose how you'll use RakshaLink.</p>

      <button
        type="button"
        onClick={onGoogle}
        disabled={googleBusy}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 py-3.5 font-semibold backdrop-blur transition hover:bg-card disabled:opacity-60"
      >
        {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or sign up with email <span className="h-px flex-1 bg-border" />
      </div>


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

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
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
