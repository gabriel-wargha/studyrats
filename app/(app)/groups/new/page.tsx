import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CreateGroupForm } from "@/components/create-group-form";
import { Skeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Create a group" };

export default function NewGroupPage() {
  return (
    <>
      <Link href="/groups" className="font-semibold text-pencil underline underline-offset-4">
        Back to groups
      </Link>
      <h1 className="font-display mt-4 text-[2.25rem] leading-[1.05] font-extrabold tracking-tight">
        Create a group
      </h1>
      <p className="mt-3 max-w-[34ch] text-lg leading-snug text-pencil">
        You get an invite code to share as soon as it is made.
      </p>
      <Suspense fallback={<FormSkeleton />}>
        <AuthGate returnPath="/groups/new">
          <CreateGroupForm />
        </AuthGate>
      </Suspense>
    </>
  );
}

function FormSkeleton() {
  return (
    <div role="status" aria-label="Loading form" className="mt-8 flex flex-col gap-6">
      <Skeleton className="h-20" />
      <Skeleton className="h-28" />
      <Skeleton className="h-14" />
    </div>
  );
}
