"use client";

import Link from "next/link";
import { useEffect } from "react";
import { outlineButton, pageShell, primaryButton } from "@/components/ui";

/** Shared body for error.tsx boundaries. Shows no raw error text, only a digest. */
export function RouteError({
  error,
  reset,
  bare = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** True when rendered inside an existing page shell (no extra padding). */
  bare?: boolean;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className={bare ? "py-6" : pageShell + " justify-center"}>
      <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight">
        That did not load
      </h1>
      <p className="mt-3 max-w-[34ch] text-base leading-6 text-muted">
        Something went wrong on our side. Your sessions are safe. Try again, or go back to your
        groups.
      </p>
      {error.digest && <p className="mt-2 text-sm text-muted">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-col gap-3">
        <button type="button" onClick={reset} className={primaryButton}>
          Try again
        </button>
        <Link href="/groups" className={outlineButton}>
          Back to groups
        </Link>
      </div>
    </div>
  );
}
