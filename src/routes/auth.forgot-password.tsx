import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Mail, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — RakshaLink" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
      toast.success("Reset link sent");
    } catch {
      toast.error("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link to="/auth/login" className="mb-6 flex items-center gap-2 text-accent">
        <ArrowLeft className="h-4 w-4" />
        <span className="font-display font-semibold">Back to sign in</span>
      </Link>
      <div className="mb-4 flex items-center gap-2 text-accent">
        <Shield className="h-5 w-5" />
        <span className="font-display font-semibold">RakshaLink</span>
      </div>
      <h1 className="text-3xl font-bold">Forgot password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email and we'll send you a reset link.
      </p>

      {sent ? (
        <div className="glass mt-8 rounded-2xl p-6 text-center text-sm text-muted-foreground">
          If an account exists for <span className="font-semibold text-foreground">{email}</span>,
          a password reset link is on its way. Check your inbox.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 focus-within:border-accent/50">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[oklch(0.5_0.22_15)] py-4 font-semibold text-primary-foreground shadow-[var(--shadow-glow-red)] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Send reset link
          </button>
        </form>
      )}
    </div>
  );
}
