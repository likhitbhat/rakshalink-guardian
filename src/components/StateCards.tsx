import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";

/** Error card shown when a data fetch fails (never a blank page). */
export function ErrorCard({
  message = "We couldn't load this right now.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="glass rounded-2xl border-primary/30 bg-primary/5 p-6 text-center">
      <AlertTriangle className="mx-auto h-7 w-7 text-primary" />
      <p className="mt-3 text-sm font-semibold">Something went wrong</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/40 px-4 py-2 text-xs font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

/** Empty-state card with a friendly illustration glyph and helpful message. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
        <Icon className="h-7 w-7 text-accent" />
      </div>
      <p className="mt-4 text-sm font-semibold">{title}</p>
      {message && <p className="mt-1 text-xs text-muted-foreground">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
