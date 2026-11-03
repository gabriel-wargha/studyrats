import { and, eq, gte, isNotNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { memberships, studySessions } from "@/lib/db/schema";

type Role = (typeof memberships.$inferSelect)["role"];

declare const groupCtxBrand: unique symbol;

/**
 * Proof that the signed-in user belongs to the group. Only requireMember
 * creates one, so queries that take a GroupCtx cannot skip the check.
 */
export type GroupCtx = Readonly<{ userId: string; groupId: string; role: Role }> & {
  readonly [groupCtxBrand]: true;
};

const uuidSchema = z.uuid();

/**
 * Returns a GroupCtx for the signed-in user, or calls notFound() when the id is
 * not a UUID or the user is not a member (404, so we never reveal whether a
 * group exists). Logged-out users are redirected by requireUser.
 */
export async function requireMember(groupId: string): Promise<GroupCtx> {
  const parsed = uuidSchema.safeParse(groupId);
  const user = await requireUser(parsed.success ? "/groups/" + parsed.data : "/");
  if (!parsed.success) notFound();

  const [row] = await getDb()
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.groupId, parsed.data), eq(memberships.userId, user.id)))
    .limit(1);
  if (!row) notFound();

  return { userId: user.id, groupId: parsed.data, role: row.role } as GroupCtx;
}

/**
 * True when the viewer owns the session, or shares a group with its owner and
 * the session ended after the owner joined that group. Running sessions are
 * visible only to their owner.
 */
export async function canSeeSession(viewerId: string, sessionId: string): Promise<boolean> {
  if (!uuidSchema.safeParse(sessionId).success) return false;

  const owner = alias(memberships, "owner_membership");
  const viewer = alias(memberships, "viewer_membership");

  const rows = await getDb()
    .select({ id: studySessions.id })
    .from(studySessions)
    .leftJoin(owner, eq(owner.userId, studySessions.userId))
    .leftJoin(viewer, and(eq(viewer.groupId, owner.groupId), eq(viewer.userId, viewerId)))
    .where(
      and(
        eq(studySessions.id, sessionId),
        or(
          eq(studySessions.userId, viewerId),
          and(
            isNotNull(viewer.userId),
            isNotNull(studySessions.endedAt),
            gte(studySessions.endedAt, owner.joinedAt),
          ),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
