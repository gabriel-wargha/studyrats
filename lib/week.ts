import { TZDate } from "@date-fns/tz";
import { startOfWeek } from "date-fns";

export const WEEK_TIME_ZONE = "America/Boise";

/**
 * The leaderboard week: Monday 00:00 (inclusive) to next Monday 00:00
 * (exclusive) in America/Boise. Weeks across a DST change are 167 or 169 hours.
 */
export function currentWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const local = new TZDate(now.getTime(), WEEK_TIME_ZONE);
  const start = startOfWeek(local, { weekStartsOn: 1 });
  // Build the next Monday from calendar fields so DST never shifts it.
  const end = new TZDate(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 7,
    0,
    0,
    0,
    WEEK_TIME_ZONE,
  );
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}
