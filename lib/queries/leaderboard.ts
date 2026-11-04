import { and, asc, eq, gt, gte, isNotNull, lt, sql } from "drizzle-orm";
import type { GroupCtx } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { memberships, profiles, studySessions } from "@/lib/db/schema";
import { pointsForMinutes } from "@/lib/points";
import { assignRanks } from "@/lib/ranking";
import { currentWeekRange } from "@/lib/week";

export type LeaderboardRange = "week" | "all";

export type LeaderboardRow = {
  userId: string;
  displayName: string;
  points: number;
  rank: number;
};

/**
 * Every member of the group with their points, best first. Members with no
 * points are included. Only sessions that ended at or after the member joined
 * this group count, and "week" also limits to the current Boise week.
 * Ties share a rank (1, 1, 3) and are listed by display name.
 */
export async function getLeaderboard(
  ctx: GroupCtx,
  range: LeaderboardRange,
  now: Date = new Date(),
): Promise<LeaderboardRow[]> {
  const week = range === "week" ? currentWeekRange(now) : null;
  const minutes = sql<number>`coalesce(sum(${studySessions.minutes}), 0)::int`;

  const rows = await getDb()
    .select({
      userId: memberships.userId,
      displayName: profiles.displayName,
      minutes,
    })
    .from(memberships)
    .innerJoin(profiles, eq(profiles.userId, memberships.userId))
    .leftJoin(
      studySessions,
      and(
        eq(studySessions.userId, memberships.userId),
        isNotNull(studySessions.endedAt),
        gt(studySessions.minutes, 0),
        gte(studySessions.endedAt, memberships.joinedAt),
        week ? gte(studySessions.endedAt, week.start) : undefined,
        week ? lt(studySessions.endedAt, week.end) : undefined,
      ),
    )
    .where(eq(memberships.groupId, ctx.groupId))
    .groupBy(memberships.userId, profiles.displayName)
    .orderBy(sql`${minutes} desc`, asc(profiles.displayName));

  // assignRanks uses a stable sort, so the SQL order is kept within ties.
  return assignRanks(
    rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      points: pointsForMinutes(r.minutes),
    })),
  );
}
