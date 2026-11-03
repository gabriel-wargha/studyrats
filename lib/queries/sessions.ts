import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { studySessions } from "@/lib/db/schema";

const sessionColumns = {
  id: studySessions.id,
  subject: studySessions.subject,
  startedAt: studySessions.startedAt,
  endedAt: studySessions.endedAt,
  minutes: studySessions.minutes,
  hasPhoto: sql<boolean>`${studySessions.photoKey} is not null`,
};

function clamp(n: number, max: number): number {
  return Math.min(Math.max(Math.trunc(n) || 1, 1), max);
}

/** The caller's running session, or null. */
export async function getActiveSession(userId: string) {
  const [row] = await getDb()
    .select(sessionColumns)
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNull(studySessions.endedAt)))
    .limit(1);
  return row ?? null;
}

/** The caller's finished sessions, newest first. */
export async function getMySessions(userId: string, limit = 50) {
  return getDb()
    .select(sessionColumns)
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNotNull(studySessions.endedAt)))
    .orderBy(desc(studySessions.endedAt))
    .limit(clamp(limit, 100));
}

/** The caller's most recently used subjects, for the datalist on the timer. */
export async function getMyRecentSubjects(userId: string, limit = 10): Promise<string[]> {
  const rows = await getDb()
    .select({ subject: studySessions.subject })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNotNull(studySessions.subject)))
    .groupBy(studySessions.subject)
    .orderBy(desc(sql`max(${studySessions.startedAt})`))
    .limit(clamp(limit, 20));
  return rows.flatMap((r) => (r.subject ? [r.subject] : []));
}
