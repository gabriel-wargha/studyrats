import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { studySessions } from "@/lib/db/schema";
import {
  MAX_PHOTO_BYTES,
  PHOTO_CONTENT_TYPE,
  buildPhotoKey,
  isValidPhotoKey,
} from "@/lib/photo-key";
import { deleteObjectQuietly, headObject, presignPut } from "@/lib/storage";
import type { ServerResult } from "@/server/groups";
import { sessionIdSchema } from "@/server/sessions";

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

const ownSession = (userId: string, sessionId: string) =>
  and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId));

/** Gives the browser a short-lived URL to PUT a JPEG to. Only for the user's own session. */
export async function createPhotoUpload(
  userId: string,
  sessionId: unknown,
): Promise<ServerResult<{ key: string; url: string; contentType: string; maxBytes: number }>> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const [session] = await getDb()
    .select({ id: studySessions.id })
    .from(studySessions)
    .where(ownSession(userId, parsed.data))
    .limit(1);
  if (!session) return { ok: false, error: "Session not found" };

  const key = buildPhotoKey(userId, parsed.data);
  const url = await presignPut(key, PHOTO_CONTENT_TYPE);
  return {
    ok: true,
    data: { key, url, contentType: PHOTO_CONTENT_TYPE, maxBytes: MAX_PHOTO_BYTES },
  };
}

const attachSchema = z.object({
  sessionId: sessionIdSchema,
  key: z.string().min(1, "Missing photo key").max(300, "Photo key is too long"),
});

/** Confirms an uploaded object and links it to the user's own session, replacing any old photo. */
export async function attachPhoto(
  userId: string,
  input: unknown,
): Promise<ServerResult<{ photoKey: string }>> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { sessionId, key } = parsed.data;

  if (!isValidPhotoKey(key, userId, sessionId)) return { ok: false, error: "Invalid photo key" };

  const db = getDb();
  const [session] = await db
    .select({ photoKey: studySessions.photoKey })
    .from(studySessions)
    .where(ownSession(userId, sessionId))
    .limit(1);
  if (!session) return { ok: false, error: "Session not found" };

  const head = await headObject(key);
  if (!head) return { ok: false, error: "Photo was not uploaded" };
  if (head.size > MAX_PHOTO_BYTES) {
    await deleteObjectQuietly(key);
    return { ok: false, error: "Photo is too large (5 MB at most)" };
  }

  const rows = await db
    .update(studySessions)
    .set({ photoKey: key })
    .where(ownSession(userId, sessionId))
    .returning({ id: studySessions.id });
  if (rows.length === 0) {
    await deleteObjectQuietly(key);
    return { ok: false, error: "Session not found" };
  }

  if (session.photoKey && session.photoKey !== key) await deleteObjectQuietly(session.photoKey);
  return { ok: true, data: { photoKey: key } };
}
