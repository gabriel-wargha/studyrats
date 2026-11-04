import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { studySessions } from "@/lib/db/schema";
import { pointsForMinutes } from "@/lib/points";
import { currentWeekRange } from "@/lib/week";

export type MyStats = { weekPoints: number; allTimePoints: number };

/**
 * The caller's own points: this Boise week and all time. This is personal, not
 * group scoped, so the group joined_at rule does not apply. Only finished
 * sessions count, and the week is decided by ended_at like the leaderboard.
 */
export async function getMyStats(userId: string, now: Date = new Date()): Promise<MyStats> {
  const week = currentWeekRange(now);
  const ended = studySessions.endedAt;
  const [row] = await getDb()
    .select({
      all: sql<number>`coalesce(sum(${studySessions.minutes}), 0)::int`,
      week: sql<number>`coalesce(sum(${studySessions.minutes}) filter (where ${ended} >= ${week.start.toISOString()}::timestamptz and ${ended} < ${week.end.toISOString()}::timestamptz), 0)::int`,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.userId, userId),
        isNotNull(studySessions.endedAt),
        gt(studySessions.minutes, 0),
      ),
    );
  return {
    weekPoints: pointsForMinutes(row?.week ?? 0),
    allTimePoints: pointsForMinutes(row?.all ?? 0),
  };
}
