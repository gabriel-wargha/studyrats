import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthGate } from "@/components/auth-gate";
import { JoinCodeForm } from "@/components/join-code-form";
import { Skeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Join a group" };

export default function JoinPage() {
  return (
    <>
      <Link href="/groups" className="font-semibold text-pencil underline underline-offset-4">
        Back to groups
      </Link>
      <h1 className="font-display mt-4 text-[2.25rem] leading-[1.05] font-extrabold tracking-tight">
        Join a group
      </h1>
      <p className="mt-3 max-w-[34ch] text-lg leading-snug text-pencil">
        Type the invite code a friend or teacher shared with you.
      </p>
      <Suspense
        fallback={
          <div role="status" aria-label="Loading form" className="mt-8 flex flex-col gap-5">
            <Skeleton className="h-20" />
            <Skeleton className="h-14" />
          </div>
        }
      >
        <AuthGate returnPath="/join">
          <JoinCodeForm />
        </AuthGate>
      </Suspense>
    </>
  );
}
