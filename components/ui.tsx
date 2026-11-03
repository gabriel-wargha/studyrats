import Link from "next/link";

export const primaryButton =
  "flex min-h-12 w-full items-center justify-center rounded-2xl bg-cheese px-6 text-base font-semibold text-[#12203a] disabled:opacity-60";
export const outlineButton =
  "flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-ink px-6 text-base font-semibold text-foreground";
export const fieldClass =
  "mt-1.5 block min-h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-base text-foreground placeholder:text-muted/70 focus:border-ink";

export const pageShell =
  "flex flex-1 flex-col px-6 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]";

export type GroupType = "friends" | "class";

export function TypeBadge({ type }: { type: GroupType }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " +
        (type === "class" ? "bg-ink text-background" : "bg-cheese text-[#12203a]")
      }
    >
      {type === "class" ? "Class" : "Friends"}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={"animate-pulse rounded-2xl bg-line motion-reduce:animate-none " + className}
    />
  );
}

export function FormError({ id, message }: { id: string; message: string | null }) {
  return (
    <div id={id} role="alert">
      {message && (
        <p className="rounded-2xl border-2 border-[#c2410c] bg-surface px-4 py-3 text-sm font-medium text-[#c2410c] dark:border-[#fb923c] dark:text-[#fb923c]">
          {message}
        </p>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line px-6 py-10 text-center">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-[32ch] text-base leading-6 text-muted">{children}</p>
    </div>
  );
}

export function PageHeader({
  title,
  back,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <header>
      {back && (
        <Link
          href={back.href}
          className="-ml-2 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-muted"
        >
          {back.label}
        </Link>
      )}
      <h1 className="font-display text-[2.25rem] font-extrabold leading-[0.98] tracking-tight">
        {title}
      </h1>
      {children}
    </header>
  );
}
