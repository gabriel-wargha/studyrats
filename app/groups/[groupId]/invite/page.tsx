import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { InviteActions } from "@/components/invite-actions";
import { Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/authz";
import { getGroupHeader, getMembers } from "@/lib/queries/groups";

export const metadata: Metadata = { title: "Invite" };

export default function InvitePage({ params }: PageProps<"/groups/[groupId]/invite">) {
  return (
    <Suspense fallback={<InviteSkeleton />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: PageProps<"/groups/[groupId]/invite">["params"] }) {
  // Render at request time before touching auth or the database.
  await connection();
  const { groupId } = await params;
  const ctx = await requireMember(groupId);
  const [group, members] = await Promise.all([getGroupHeader(ctx), getMembers(ctx)]);
  if (!group) throw new Error("Group disappeared after membership check");

  return (
    <div className="space-y-8">
      <section aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="text-base font-semibold">
          Invite code
        </h2>
        <p className="mt-1 text-sm text-muted">
          Friends enter this code on the Join screen, or open your link.
        </p>
        <p
          aria-label={`Invite code ${group.inviteCode.split("").join(" ")}`}
          className="mt-4 select-all break-all rounded-3xl border-2 border-ink bg-surface px-4 py-7 text-center font-display text-[2.5rem] font-extrabold leading-none tracking-[0.12em]"
        >
          {group.inviteCode}
        </p>
        <div className="mt-4">
          <InviteActions code={group.inviteCode} groupName={group.name} />
        </div>
      </section>

      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="font-display text-2xl font-bold tracking-tight">
          Members ({members.length})
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-3xl border-2 border-line bg-surface">
          {members.map((m) => (
            <li key={m.userId} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-base font-bold text-background"
              >
                {m.displayName.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-medium">
                {m.displayName}
                {m.userId === ctx.userId && <span className="text-muted"> (you)</span>}
              </span>
              {m.role === "owner" && (
                <span className="shrink-0 rounded-full bg-cheese px-2.5 py-0.5 text-xs font-semibold text-[#12203a]">
                  Owner
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function InviteSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading invite" className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-12" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}
