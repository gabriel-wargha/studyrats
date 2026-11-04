/** A pulsing placeholder block. Decorative, so hidden from screen readers. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-xl bg-rule/70 motion-reduce:animate-none ${className}`}
    />
  );
}
