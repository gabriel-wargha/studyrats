import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LeaderboardList, RangeToggle } from "@/components/leaderboard";
import { EmptyState, Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/authz";
import { getLeaderboard, type LeaderboardRange } from "@/lib/queries/leaderboard";

export const metadata: Metadata = { title: "Leaderboard" };

type Props = PageProps<"/groups/[groupId]/leaderboard">;

export default function LeaderboardPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LeaderboardContent({
  params,
  searchParams,
}: {
  params: Props["params"];
  searchParams: Props["searchParams"];
}) {
  // Render at request time before touching auth or the database.
  await connection();
  const { groupId } = await params;
  const { range: rawRange } = await searchParams;
  const range: LeaderboardRange = rawRange === "all" ? "all" : "week";

  const ctx = await requireMember(groupId);
  const rows = await getLeaderboard(ctx, range);
  const nobodyScored = rows.every((r) => r.points === 0);

  return (
    <div className="flex flex-col gap-4">
      <RangeToggle basePath={`/groups/${ctx.groupId}/leaderboard`} range={range} />
      {rows.length === 0 || nobodyScored ? (
        <EmptyState title="No points yet">
          {range === "week"
            ? "Nobody has studied this week. Start a session to take first place."
            : "Nobody has studied yet. Start a session to take first place."}
        </EmptyState>
      ) : (
        <LeaderboardList rows={rows} myUserId={ctx.userId} />
      )}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading leaderboard" className="flex flex-col gap-2">
      <Skeleton className="mb-2 h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}
