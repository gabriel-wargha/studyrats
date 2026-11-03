import { and, eq, isNull, sql } from "drizzle-orm";
import type { ZodError } from "zod";
import { getDb } from "@/lib/db";
import { studySessions } from "@/lib/db/schema";
import { MAX_SESSION_MINUTES } from "@/lib/points";
import { getActiveSession } from "@/lib/queries/sessions";
import {
  startSessionSchema,
  stopSessionSchema,
  updateSubjectSchema,
} from "@/lib/schemas/sessions";
import type { ActionResult } from "@/server/groups";

type PgErrorLike = { code?: string; constraint?: string; cause?: unknown };

/** True for a unique violation on the one-running-session-per-user index (Drizzle wraps the driver error in `cause`). */
function isAlreadyRunning(err: unknown): boolean {
  let e = err as PgErrorLike | undefined;
  for (let i = 0; e && i < 4; i++) {
    if (e.code === "23505" && (!e.constraint || e.constraint.includes("one_running"))) return true;
    e = e.cause as PgErrorLike | undefined;
  }
  return false;
}

function invalid(error: string, zodError: ZodError): { ok: false; error: string; fieldErrors: Record<string, string[] | undefined> } {
  return { ok: false, error, fieldErrors: zodError.flatten().fieldErrors };
}

/**
 * HOOK FOR B10: delete the photo object from the private `photos` bucket.
 * lib/storage.ts does not exist yet. When B10 lands, replace the body with
 * `await deleteObject(key)`. Failures must not break stopping a session.
 */
async function deletePhotoObject(key: string): Promise<void> {
  void key;
}

export type StartedSession = {
  id: string;
  subject: string | null;
  startedAt: Date;
  alreadyRunning: boolean;
};

/** Starts a timer. If one is already running, returns that one instead. */
export async function startSession(
  userId: string,
  input: unknown,
): Promise<ActionResult<StartedSession>> {
  const parsed = startSessionSchema.safeParse(input ?? {});
  if (!parsed.success) return invalid("Check the subject and try again", parsed.error);

  try {
    const [row] = await getDb()
      .insert(studySessions)
      .values({ userId, subject: parsed.data.subject })
      .returning({
        id: studySessions.id,
        subject: studySessions.subject,
        startedAt: studySessions.startedAt,
      });
    return { ok: true, data: { ...row, alreadyRunning: false } };
  } catch (err) {
    if (!isAlreadyRunning(err)) throw err;
    const existing = await getActiveSession(userId);
    if (!existing) return { ok: false, error: "Could not start the timer, please try again" };
    return {
      ok: true,
      data: {
        id: existing.id,
        subject: existing.subject,
        startedAt: existing.startedAt,
        alreadyRunning: true,
      },
    };
  }
}

/**
 * Stops the caller's running session. Minutes are computed in SQL and capped
 * at 360. Under one minute the session (and its photo) is deleted.
 * `minutes: 0` means "too short to count".
 */
export async function stopSession(
  userId: string,
  input: unknown,
): Promise<ActionResult<{ minutes: number; capped: boolean }>> {
  const parsed = stopSessionSchema.safeParse(input);
  if (!parsed.success) return invalid("That session id does not look right", parsed.error);
  const { id } = parsed.data;

  const rawMinutes = sql<number>`floor(extract(epoch from (now() - ${studySessions.startedAt})) / 60)::int`;
  const db = getDb();
  const [row] = await db
    .update(studySessions)
    .set({
      endedAt: sql`now()`,
      minutes: sql`greatest(least(${rawMinutes}, ${MAX_SESSION_MINUTES}), 0)`,
    })
    .where(
      and(
        eq(studySessions.id, id),
        eq(studySessions.userId, userId),
        isNull(studySessions.endedAt),
      ),
    )
    .returning({
      minutes: studySessions.minutes,
      photoKey: studySessions.photoKey,
      rawMinutes,
    });
  // Not found, someone else's, or already stopped: all look the same.
  if (!row) return { ok: false, error: "No running session found" };

  if (row.rawMinutes < 1) {
    await db
      .delete(studySessions)
      .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)));
    if (row.photoKey) {
      try {
        await deletePhotoObject(row.photoKey);
      } catch {
        // An orphaned object is accepted in v1; never fail the stop for it.
      }
    }
    return { ok: true, data: { minutes: 0, capped: false } };
  }

  return {
    ok: true,
    data: { minutes: row.minutes ?? 0, capped: row.rawMinutes > MAX_SESSION_MINUTES },
  };
}

/** Changes the subject of one of the caller's own sessions. */
export async function updateSubject(
  userId: string,
  input: unknown,
): Promise<ActionResult<{ subject: string | null }>> {
  const parsed = updateSubjectSchema.safeParse(input);
  if (!parsed.success) return invalid("Check the subject and try again", parsed.error);

  const [row] = await getDb()
    .update(studySessions)
    .set({ subject: parsed.data.subject })
    .where(and(eq(studySessions.id, parsed.data.id), eq(studySessions.userId, userId)))
    .returning({ subject: studySessions.subject });
  if (!row) return { ok: false, error: "Session not found" };
  return { ok: true, data: { subject: row.subject } };
}
