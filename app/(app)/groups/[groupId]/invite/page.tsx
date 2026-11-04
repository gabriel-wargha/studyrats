import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { InviteActions } from "@/components/invite-actions";
import { Skeleton } from "@/components/skeleton";
import { requireMember } from "@/lib/authz";
import { getGroupHeader, getMembers } from "@/server/groups";

export const metadata: Metadata = { title: "Invite" };

export default function InvitePage({ params }: PageProps<"/groups/[groupId]/invite">) {
  return (
    <Suspense fallback={<InviteSkeleton />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: PageProps<"/groups/[groupId]/invite">["params"] }) {
  await connection(); // per-request: never run auth during prerender
  const { groupId } = await params;
  const ctx = await requireMember(groupId);
  const [group, members] = await Promise.all([getGroupHeader(ctx), getMembers(ctx)]);
  if (!group) return null;

  return (
    <>
      <section className="rounded-2xl bg-chalk p-6 text-paper">
        <h2 className="text-lg text-paper/80">Invite code</h2>
        <p
          aria-label={`Invite code ${group.inviteCode.split("").join(" ")}`}
          className="font-display mt-2 text-[2.75rem] leading-none font-extrabold tracking-[0.12em] text-highlighter"
        >
          {group.inviteCode}
        </p>
        <p className="mt-3 text-paper/80">Anyone with this code can join the group.</p>
      </section>
      <div className="mt-4">
        <InviteActions code={group.inviteCode} groupName={group.name} />
      </div>

      <section className="mt-6" aria-labelledby="members-heading">
        <h2 id="members-heading" className="font-display text-2xl font-bold">
          Members ({members.length})
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex min-h-14 items-center gap-3 rounded-xl bg-white px-4 ring-2 ring-rule"
            >
              <span
                aria-hidden
                className="font-display flex size-9 shrink-0 items-center justify-center rounded-full bg-highlighter font-bold text-ink"
              >
                {m.displayName.trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-lg font-semibold">
                {m.displayName}
                {m.userId === ctx.userId && <span className="font-normal text-pencil"> (you)</span>}
              </span>
              {m.role === "owner" && <span className="text-sm text-pencil">Owner</span>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function InviteSkeleton() {
  return (
    <div role="status" aria-label="Loading invite" className="flex flex-col gap-4">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}
