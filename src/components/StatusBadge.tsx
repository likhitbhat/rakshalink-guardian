import { cn } from "@/lib/utils";

type Variant = "safe" | "warn" | "danger" | "muted";

export function StatusBadge({
  variant = "safe",
  children,
  pulse,
  className,
}: {
  variant?: Variant;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  const colors: Record<Variant, string> = {
    safe: "bg-success/15 text-success border-success/30",
    warn: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-primary/15 text-primary border-primary/40",
    muted: "bg-muted/40 text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        colors[variant],
        className,
      )}
    >
      {pulse && <span className={cn("h-1.5 w-1.5 rounded-full", variant === "danger" ? "bg-primary" : variant === "warn" ? "bg-warning" : "bg-success", "animate-pulse")} />}
      {children}
    </span>
  );
}
