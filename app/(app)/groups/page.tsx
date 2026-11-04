import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { GroupTypeBadge } from "@/components/group-type-badge";
import { Skeleton } from "@/components/skeleton";
import { primaryButton, secondaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth/server";
import { getMyGroups } from "@/server/groups";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return (
    <>
      <h1 className="font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight">
        Your groups
      </h1>
      <Suspense fallback={<GroupsSkeleton />}>
        <GroupList />
      </Suspense>
    </>
  );
}

async function GroupList() {
  await connection(); // per-request: never run auth during prerender
  const user = await requireUser("/groups");
  const groups = await getMyGroups(user.id);

  if (groups.length === 0) {
    return (
      <section className="mt-6 rounded-2xl bg-chalk p-6 text-paper">
        <h2 className="font-display text-2xl font-bold">No groups yet</h2>
        <p className="mt-2 max-w-[34ch] text-lg leading-snug text-paper/80">
          Start one for your friends or class, or join with a code someone sent you.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/groups/new" className={primaryButton}>
            Create a group
          </Link>
          <Link
            href="/join"
            className="flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-lg font-bold text-paper ring-2 ring-paper/40"
          >
            Join with a code
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <ul className="mt-6 flex flex-col gap-3">
        {groups.map((g) => (
          <li key={g.id}>
            <Link
              href={`/groups/${g.id}`}
              className="flex min-h-20 items-center gap-4 rounded-2xl bg-white p-4 ring-2 ring-rule"
            >
              <span className="min-w-0 flex-1">
                <span className="font-display block truncate text-xl font-bold">{g.name}</span>
                <span className="mt-1 block">
                  <GroupTypeBadge type={g.type} />
                </span>
              </span>
              <span className="text-right">
                <span className="font-display block text-2xl leading-none font-extrabold tabular-nums">
                  {g.weeklyPoints}
                </span>
                <span className="text-sm text-pencil">pts this week</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/groups/new" className={primaryButton}>
          Create
        </Link>
        <Link href="/join" className={secondaryButton}>
          Join
        </Link>
      </div>
    </>
  );
}

function GroupsSkeleton() {
  return (
    <div role="status" aria-label="Loading your groups" className="mt-6 flex flex-col gap-3">
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}
