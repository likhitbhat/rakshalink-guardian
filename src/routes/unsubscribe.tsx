import { useEffect, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: UnsubscribePage,
});

type State = "loading" | "valid" | "already" | "invalid" | "done" | "error";

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          setState("invalid");
        } else if (data.valid) {
          setState("valid");
        } else {
          setState("already");
        }
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  async function confirm() {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <p className="text-sm text-muted-foreground">Checking your link…</p>
          )}
          {state === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                You'll stop receiving non-essential emails from RakshaLink. Confirm below.
              </p>
              <Button onClick={confirm} disabled={submitting} className="w-full">
                {submitting ? "Unsubscribing…" : "Confirm unsubscribe"}
              </Button>
            </>
          )}
          {state === "already" && (
            <p className="text-sm text-muted-foreground">
              You're already unsubscribed. No further action is needed.
            </p>
          )}
          {state === "done" && (
            <p className="text-sm text-muted-foreground">
              You've been unsubscribed. You may still receive critical safety alerts.
            </p>
          )}
          {state === "invalid" && (
            <p className="text-sm text-muted-foreground">
              This unsubscribe link is invalid or has expired.
            </p>
          )}
          {state === "error" && (
            <p className="text-sm text-muted-foreground">
              Something went wrong. Please try again later.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
