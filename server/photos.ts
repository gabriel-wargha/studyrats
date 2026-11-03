import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { studySessions } from "@/lib/db/schema";
import { buildPhotoKey, isValidPhotoKey, MAX_PHOTO_BYTES } from "@/lib/photo-key";
import { attachPhotoSchema, createPhotoUploadSchema } from "@/lib/schemas/photos";
import { deleteObject, headObject, presignPut } from "@/lib/storage";
import type { ActionResult } from "@/server/groups";

async function ownedSession(userId: string, id: string) {
  const [row] = await getDb()
    .select({ photoKey: studySessions.photoKey })
    .from(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Best effort: an orphaned object is accepted, a failed delete never blocks the caller. */
async function tryDelete(key: string): Promise<void> {
  try {
    await deleteObject(key);
  } catch {
    // ignore
  }
}

/** Gives the caller an upload URL for one of their own sessions. */
export async function createPhotoUpload(
  userId: string,
  input: unknown,
): Promise<ActionResult<{ key: string; url: string }>> {
  const parsed = createPhotoUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That session id does not look right" };
  if (!(await ownedSession(userId, parsed.data.sessionId))) {
    return { ok: false, error: "Session not found" };
  }
  const key = buildPhotoKey(userId, parsed.data.sessionId);
  const url = await presignPut(key, "image/jpeg");
  return { ok: true, data: { key, url } };
}

/** Checks the uploaded object, saves its key on the session and removes the old photo. */
export async function attachPhoto(
  userId: string,
  input: unknown,
): Promise<ActionResult<{ key: string }>> {
  const parsed = attachPhotoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the photo details and try again" };
  const { sessionId, key } = parsed.data;

  const session = await ownedSession(userId, sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  // Never touch (or delete) an object outside this user's own session prefix.
  if (!isValidPhotoKey(userId, sessionId, key)) return { ok: false, error: "Invalid photo key" };

  const head = await headObject(key);
  if (!head) return { ok: false, error: "Photo was not uploaded, please try again" };
  if (head.size > MAX_PHOTO_BYTES) {
    await tryDelete(key);
    return { ok: false, error: "Photo is too large (5 MB maximum)" };
  }

  const [row] = await getDb()
    .update(studySessions)
    .set({ photoKey: key })
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
    .returning({ id: studySessions.id });
  if (!row) {
    await tryDelete(key);
    return { ok: false, error: "Session not found" };
  }

  if (session.photoKey && session.photoKey !== key) await tryDelete(session.photoKey);
  return { ok: true, data: { key } };
}
