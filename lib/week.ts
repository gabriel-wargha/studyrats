import { TZDate } from "@date-fns/tz";
import { addWeeks, startOfWeek } from "date-fns";

/** Rexburg is on Mountain Time. */
export const WEEK_TIME_ZONE = "America/Boise";

/**
 * The leaderboard week: Monday 00:00 (inclusive) to next Monday 00:00
 * (exclusive) in America/Boise. Calendar maths is done in the zone, so a
 * DST week is 167 or 169 hours long, not always 168.
 */
export function currentWeekRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const local = new TZDate(now.getTime(), WEEK_TIME_ZONE);
  const start = startOfWeek(local, { weekStartsOn: 1 });
  const end = addWeeks(start, 1);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}
