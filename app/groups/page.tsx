import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import { getMyGroups } from "@/lib/queries/groups";
import {
  EmptyState,
  PageHeader,
  Skeleton,
  TypeBadge,
  outlineButton,
  pageShell,
  primaryButton,
} from "@/components/ui";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return (
    <main className={pageShell}>
      <PageHeader title="Your groups" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link href="/groups/new" className={primaryButton}>
          Create a group
        </Link>
        <Link href="/join" className={outlineButton}>
          Join with a code
        </Link>
      </div>
      <section aria-label="Groups" className="mt-8">
        <Suspense fallback={<GroupsSkeleton />}>
          <GroupList />
        </Suspense>
      </section>
    </main>
  );
}

async function GroupList() {
  // Render at request time before touching auth or the database.
  await connection();
  const user = await requireUser("/groups");
  const groups = await getMyGroups(user.id);

  if (groups.length === 0) {
    return (
      <EmptyState title="No groups yet">
        Create one for your friends or your class, or join one with an invite code.
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {groups.map((g) => (
        <li key={g.id}>
          <Link
            href={`/groups/${g.id}`}
            className="flex min-h-20 items-center justify-between gap-4 rounded-3xl border-2 border-line bg-surface px-5 py-4"
          >
            <span className="min-w-0">
              <span className="block truncate font-display text-xl font-bold tracking-tight">
                {g.name}
              </span>
              <span className="mt-1.5 block">
                <TypeBadge type={g.type} />
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-display text-3xl font-extrabold leading-none">
                {g.weeklyPoints}
              </span>
              <span className="mt-1 block text-xs text-muted">points this week</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GroupsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading groups" className="space-y-3">
      <Skeleton className="h-20 rounded-3xl" />
      <Skeleton className="h-20 rounded-3xl" />
      <Skeleton className="h-20 rounded-3xl" />
    </div>
  );
}
