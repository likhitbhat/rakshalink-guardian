import { cn } from "@/lib/utils";

/**
 * Base skeleton — glassmorphic, dark-slate friendly shimmer block.
 * Matches RakshaLink's design tokens (uses card/border colors via tokens).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

/** A single line of text. Use `lines` for stacked paragraph placeholders. */
function SkeletonText({
  lines = 1,
  className,
  lastLineWidth = "70%",
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{ width: i === lines - 1 && lines > 1 ? lastLineWidth : "100%" }}
        />
      ))}
    </div>
  );
}

/** Circular avatar placeholder. */
function SkeletonAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Skeleton
      className={cn("shrink-0 rounded-full", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Pill / button placeholder. */
function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-9 w-24 rounded-xl", className)} />;
}

/** Small status-badge placeholder. */
function SkeletonBadge({ className }: { className?: string }) {
  return <Skeleton className={cn("h-5 w-16 rounded-full", className)} />;
}

/** Generic glass card placeholder with optional children for custom inner layout. */
function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("glass rounded-2xl p-4", className)}>
      {children ?? (
        <>
          <Skeleton className="h-4 w-1/3" />
          <SkeletonText lines={2} className="mt-3" />
        </>
      )}
    </div>
  );
}

/** Full map-area placeholder with a soft pulsing overlay. */
function SkeletonMap({ height = 420, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-[var(--glass-bg-strong)]",
        className,
      )}
      style={{ height }}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--glass-bg)] via-transparent to-[var(--glass-bg)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full border-2 border-accent/40 border-t-accent" />
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonBadge,
  SkeletonCard,
  SkeletonMap,
};
