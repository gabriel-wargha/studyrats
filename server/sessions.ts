import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { studySessions } from "@/lib/db/schema";
import { MAX_SESSION_MINUTES } from "@/lib/points";
import { deleteObjectQuietly } from "@/lib/storage";
import type { ServerResult } from "@/server/groups";

export const subjectSchema = z
  .string()
  .trim()
  .max(60, "Subject is at most 60 characters")
  .transform((s) => (s === "" ? null : s))
  .nullish()
  .transform((s) => s ?? null);

export const startSessionSchema = z.object({ subject: subjectSchema });
export const sessionIdSchema = z.uuid("That session id does not look right");

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e && typeof e === "object"; i++) {
    if ((e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

const activeColumns = {
  id: studySessions.id,
  subject: studySessions.subject,
  startedAt: studySessions.startedAt,
  photoKey: studySessions.photoKey,
};

export type ActiveSession = {
  id: string;
  subject: string | null;
  startedAt: Date;
  photoKey: string | null;
};

/** The user's running session, or null. */
export async function getActiveSession(userId: string): Promise<ActiveSession | null> {
  const [row] = await getDb()
    .select(activeColumns)
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNull(studySessions.endedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Starts a timer. If one is already running (unique index violation) the
 * running one is returned instead, with `alreadyRunning: true`.
 */
export async function startSession(
  userId: string,
  input: unknown,
): Promise<ServerResult<{ session: ActiveSession; alreadyRunning: boolean }>> {
  const parsed = startSessionSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  try {
    const [row] = await getDb()
      .insert(studySessions)
      .values({ userId, subject: parsed.data.subject })
      .returning(activeColumns);
    return { ok: true, data: { session: row, alreadyRunning: false } };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await getActiveSession(userId);
    if (!existing) return { ok: false, error: "Could not start the timer. Please try again." };
    return { ok: true, data: { session: existing, alreadyRunning: true } };
  }
}

export type StopResult = {
  minutes: number;
  capped: boolean;
  /** True when under 1 minute: the session was deleted and earns nothing. */
  discarded: boolean;
  /** Photo of a discarded session. The caller must delete this object from storage. */
  orphanedPhotoKey: string | null;
};

/**
 * Stops the user's own running session. Someone else's id behaves as not found.
 *
 * The clock, the whole-minute rounding and the 360 cap all run in one SQL
 * UPDATE ... RETURNING, so started_at and the end time come from the same
 * database clock (mirrors computeMinutes in lib/points.ts). A result of 0
 * minutes is then deleted, together with its photo.
 */
export async function stopSession(userId: string, id: unknown): Promise<ServerResult<StopResult>> {
  const parsedId = sessionIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: firstError(parsedId.error) };
  const notFound = { ok: false, error: "No running session found" } as const;

  const db = getDb();
  const rawMinutes = sql<number>`floor(extract(epoch from (${studySessions.endedAt} - ${studySessions.startedAt})) / 60)::int`;
  const [stopped] = await db
    .update(studySessions)
    .set({
      endedAt: sql`now()`,
      minutes: sql`least(floor(extract(epoch from (now() - ${studySessions.startedAt})) / 60), ${MAX_SESSION_MINUTES})::int`,
    })
    .where(
      and(
        eq(studySessions.id, parsedId.data),
        eq(studySessions.userId, userId),
        isNull(studySessions.endedAt),
      ),
    )
    .returning({ minutes: studySessions.minutes, rawMinutes, photoKey: studySessions.photoKey });
  if (!stopped) return notFound;

  const minutes = stopped.minutes ?? 0;
  if (minutes < 1) {
    // Too short to count. Only deletes the row we just closed (minutes = 0).
    await db
      .delete(studySessions)
      .where(
        and(
          eq(studySessions.id, parsedId.data),
          eq(studySessions.userId, userId),
          eq(studySessions.minutes, 0),
        ),
      );
    await deleteObjectQuietly(stopped.photoKey); // best effort, never throws
    return {
      ok: true,
      data: { minutes: 0, capped: false, discarded: true, orphanedPhotoKey: stopped.photoKey },
    };
  }

  return {
    ok: true,
    data: {
      minutes,
      capped: stopped.rawMinutes > MAX_SESSION_MINUTES,
      discarded: false,
      orphanedPhotoKey: null,
    },
  };
}

/** Changes the subject of one of the user's own sessions (running or finished). */
export async function updateSubject(
  userId: string,
  id: unknown,
  subject: unknown,
): Promise<ServerResult<{ subject: string | null }>> {
  const parsedId = sessionIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: firstError(parsedId.error) };
  const parsed = subjectSchema.safeParse(subject);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const rows = await getDb()
    .update(studySessions)
    .set({ subject: parsed.data })
    .where(and(eq(studySessions.id, parsedId.data), eq(studySessions.userId, userId)))
    .returning({ subject: studySessions.subject });
  if (rows.length === 0) return { ok: false, error: "Session not found" };
  return { ok: true, data: { subject: rows[0].subject } };
}

/** The user's finished sessions, newest first. */
export async function getMySessions(userId: string, limit = 20) {
  const n = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  return getDb()
    .select({
      id: studySessions.id,
      subject: studySessions.subject,
      startedAt: studySessions.startedAt,
      endedAt: studySessions.endedAt,
      minutes: studySessions.minutes,
      photoKey: studySessions.photoKey,
    })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNotNull(studySessions.endedAt)))
    .orderBy(desc(studySessions.endedAt))
    .limit(n);
}

/** Distinct subjects the user used recently, newest first (for quick pick chips). */
export async function getMyRecentSubjects(userId: string, limit = 8): Promise<string[]> {
  const rows = await getDb()
    .select({ subject: studySessions.subject })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNotNull(studySessions.subject)))
    .orderBy(desc(studySessions.startedAt))
    .limit(50);
  const seen = new Set<string>();
  for (const r of rows) if (r.subject) seen.add(r.subject);
  return [...seen].slice(0, limit);
}
