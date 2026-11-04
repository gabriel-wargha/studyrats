import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { canSeeSession } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { reactions } from "@/lib/db/schema";
import { REACTION_KINDS } from "@/server/feed";
import type { ServerResult } from "@/server/groups";
import { sessionIdSchema } from "@/server/sessions";

const toggleSchema = z.object({
  sessionId: sessionIdSchema,
  kind: z.enum(REACTION_KINDS as [string, ...string[]], { message: "Unknown reaction" }),
});

/**
 * Adds the viewer's reaction to a check-in, or removes it if already there.
 * Only for sessions the viewer can see. A session they cannot see answers
 * "Session not found", the same as one that does not exist.
 * Returns `active: true` when the reaction is now on.
 */
export async function toggleReaction(
  userId: string,
  input: unknown,
): Promise<ServerResult<{ sessionId: string; kind: string; active: boolean }>> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { sessionId } = parsed.data;
  const kind = parsed.data.kind as (typeof REACTION_KINDS)[number];

  if (!(await canSeeSession(userId, sessionId))) return { ok: false, error: "Session not found" };

  const db = getDb();
  const removed = await db
    .delete(reactions)
    .where(and(eq(reactions.sessionId, sessionId), eq(reactions.userId, userId), eq(reactions.kind, kind)))
    .returning({ kind: reactions.kind });
  if (removed.length > 0) return { ok: true, data: { sessionId, kind, active: false } };

  // onConflictDoNothing covers a double tap racing with this call.
  await db.insert(reactions).values({ sessionId, userId, kind }).onConflictDoNothing();
  return { ok: true, data: { sessionId, kind, active: true } };
}
