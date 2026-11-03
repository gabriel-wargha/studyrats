import { connection } from "next/server";
import { Suspense } from "react";
import { GroupTabs } from "@/components/group-tabs";
import { PageHeader, Skeleton, TypeBadge, pageShell } from "@/components/ui";
import { requireMember } from "@/lib/authz";
import { getGroupHeader } from "@/lib/queries/groups";

export default function GroupLayout({ children, params }: LayoutProps<"/groups/[groupId]">) {
  return (
    <div className={pageShell}>
      <Suspense fallback={<GroupShellSkeleton />}>
        <GroupShell params={params}>{children}</GroupShell>
      </Suspense>
    </div>
  );
}

async function GroupShell({
  params,
  children,
}: {
  params: LayoutProps<"/groups/[groupId]">["params"];
  children: React.ReactNode;
}) {
  // Render at request time before touching auth or the database.
  await connection();
  const { groupId } = await params;
  // 404 for non-members and bad ids; children only render after this passes.
  const ctx = await requireMember(groupId);
  const group = await getGroupHeader(ctx);
  if (!group) throw new Error("Group disappeared after membership check");

  return (
    <>
      <PageHeader title={group.name} back={{ href: "/groups", label: "All groups" }}>
        <div className="mt-3 flex items-center gap-3 text-base text-muted">
          <TypeBadge type={group.type} />
          <span>
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
      </PageHeader>
      <GroupTabs groupId={ctx.groupId} />
      <div className="mt-6">{children}</div>
    </>
  );
}

function GroupShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading group">
      <Skeleton className="h-11 w-28" />
      <Skeleton className="mt-2 h-10 w-56" />
      <Skeleton className="mt-4 h-6 w-40" />
      <Skeleton className="mt-5 h-14" />
      <Skeleton className="mt-6 h-40 rounded-3xl" />
    </div>
  );
}
