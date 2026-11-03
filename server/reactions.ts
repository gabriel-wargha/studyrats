import { and, eq } from "drizzle-orm";
import { canSeeSession } from "@/lib/authz";
import type { GroupCtx } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { reactions } from "@/lib/db/schema";
import { type FeedPage, getFeed, InvalidCursorError } from "@/lib/queries/feed";
import { toggleReactionSchema } from "@/lib/schemas/reactions";
import type { ActionResult } from "@/server/groups";

/**
 * Adds the reaction if the user has not used it on this check-in, otherwise removes it.
 * Returns `active: true` when the reaction is now on.
 */
export async function toggleReaction(
  userId: string,
  input: unknown,
): Promise<ActionResult<{ active: boolean }>> {
  const parsed = toggleReactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the reaction and try again",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { sessionId, kind } = parsed.data;

  // Same message for a missing and a hidden session, so ids cannot be probed.
  if (!(await canSeeSession(userId, sessionId))) return { ok: false, error: "Check-in not found" };

  const db = getDb();
  const removed = await db
    .delete(reactions)
    .where(
      and(eq(reactions.sessionId, sessionId), eq(reactions.userId, userId), eq(reactions.kind, kind)),
    )
    .returning({ sessionId: reactions.sessionId });
  if (removed.length > 0) return { ok: true, data: { active: false } };

  // The primary key makes a concurrent double tap harmless.
  await db.insert(reactions).values({ sessionId, userId, kind }).onConflictDoNothing();
  return { ok: true, data: { active: true } };
}

/** Loads one more page of the feed for a group the caller already proved membership of. */
export async function loadFeedPage(
  ctx: GroupCtx,
  cursor?: string,
): Promise<ActionResult<FeedPage>> {
  try {
    return { ok: true, data: await getFeed(ctx, cursor) };
  } catch (err) {
    if (err instanceof InvalidCursorError) {
      return { ok: false, error: "Could not load more, please refresh the feed" };
    }
    throw err;
  }
}
