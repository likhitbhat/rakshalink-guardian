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
import { Shield, Mail, Lock, Loader2, MailCheck } from "lucide-react";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — RakshaLink" }] }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resending, setResending] = useState(false);
  const nav = useNavigate();

  function describeError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes("invalid login credentials")) return "Wrong email or password.";
    if (m.includes("email not confirmed")) return "Please verify your email before signing in.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Network error — check your connection and try again.";
    return message;
  }

  function fallbackToMock(reason: string) {
    const s = signInMock(email || "demo@rakshalink.app");
    toast.success(`Preview mode — signed in as ${s.role === "guardian" ? "guardian" : "wearer"} (${reason})`);
    nav({ to: mockPostAuthPath(s) });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNeedsVerify(false);
    try {
      if (!isBackendConfigured()) {
        fallbackToMock("backend not configured");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (isBackendFailure(error.message)) {
          fallbackToMock("backend unavailable");
          return;
        }
        if (error.message.toLowerCase().includes("email not confirmed")) setNeedsVerify(true);
        toast.error(describeError(error.message));
        return;
      }
      toast.success("Welcome back");
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
      if (result.redirected) return; // browser will navigate to Google
      const { data } = await supabase.auth.getUser();
      const path = data.user ? await resolvePostAuthPath(data.user.id) : "/app";
      nav({ to: path });
    } catch (err) {
      toast.error("Network error — check your connection and try again.");
      setGoogleBusy(false);
    }
  }

  async function resendVerification() {
    if (!email) return toast.error("Enter your email first");
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setResending(false);
    if (error) return toast.error(describeError(error.message));
    toast.success("Verification email sent — check your inbox");
  }

  return (
    <div>
      <Link to="/" className="mb-6 flex items-center gap-2 text-accent">
        <Shield className="h-5 w-5" />
        <span className="font-display font-semibold">RakshaLink</span>
      </Link>
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your safety network.</p>

      <button
        type="button"
        onClick={onGoogle}
        disabled={googleBusy}
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 py-3.5 font-semibold backdrop-blur transition hover:bg-card disabled:opacity-60"
      >
        {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} />
        <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} />
        <div className="text-right">
          <Link to="/auth/forgot-password" className="text-xs font-semibold text-accent">
            Forgot password?
          </Link>
        </div>
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-4 font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </button>
      </form>

      {needsVerify && (
        <button
          type="button"
          onClick={resendVerification}
          disabled={resending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 py-3 text-sm font-semibold text-accent disabled:opacity-60"
        >
          {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
          Resend verification email
        </button>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/auth/register" className="font-semibold text-accent">
          Create account
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
