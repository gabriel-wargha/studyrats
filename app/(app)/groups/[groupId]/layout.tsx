import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { GroupTabs } from "@/components/group-tabs";
import { GroupTypeBadge } from "@/components/group-type-badge";
import { Skeleton } from "@/components/skeleton";
import { requireMember } from "@/lib/authz";
import { getGroupHeader } from "@/server/groups";

/**
 * Shared by every group screen. The membership check lives here and the
 * children render inside it, so no group page shows without it. Pages that read
 * group data still call requireMember themselves to get their own GroupCtx.
 */
export default function GroupLayout({
  children,
  params,
}: LayoutProps<"/groups/[groupId]">) {
  return (
    <Suspense fallback={<GroupSkeleton />}>
      <GroupShell params={params}>{children}</GroupShell>
    </Suspense>
  );
}

async function GroupShell({
  params,
  children,
}: {
  params: LayoutProps<"/groups/[groupId]">["params"];
  children: ReactNode;
}) {
  await connection(); // per-request: never run auth during prerender
  const { groupId } = await params;
  const ctx = await requireMember(groupId);
  const group = await getGroupHeader(ctx);
  if (!group) return null;

  return (
    <>
      <header>
        <h1 className="font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight text-balance">
          {group.name}
        </h1>
        <div className="mt-2">
          <GroupTypeBadge type={group.type} />
        </div>
      </header>
      <GroupTabs groupId={ctx.groupId} />
      <div className="mt-6">{children}</div>
    </>
  );
}

function GroupSkeleton() {
  return (
    <div role="status" aria-label="Loading group" className="flex flex-col gap-4">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-13 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}
