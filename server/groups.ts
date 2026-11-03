import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { groups, memberships } from "@/lib/db/schema";
import { generateInviteCode } from "@/lib/invite-code";
import { createGroupSchema, joinGroupSchema } from "@/lib/schemas/groups";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

const MAX_CODE_ATTEMPTS = 5;

type PgErrorLike = { code?: string; constraint?: string; cause?: unknown };

/** True for a unique violation on the invite code (Drizzle wraps the driver error in `cause`). */
function isInviteCodeCollision(err: unknown): boolean {
  let e = err as PgErrorLike | undefined;
  for (let i = 0; e && i < 4; i++) {
    if (e.code === "23505" && (!e.constraint || e.constraint.includes("invite_code"))) return true;
    e = e.cause as PgErrorLike | undefined;
  }
  return false;
}

/** Creates a group and the creator's owner membership in one transaction. */
export async function createGroup(
  userId: string,
  input: unknown,
): Promise<ActionResult<{ groupId: string; inviteCode: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the form and try again",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { name, type } = parsed.data;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      const groupId = await getDb().transaction(async (tx) => {
        const [group] = await tx
          .insert(groups)
          .values({ name, type, inviteCode, createdBy: userId })
          .returning({ id: groups.id });
        await tx.insert(memberships).values({ groupId: group.id, userId, role: "owner" });
        return group.id;
      });
      return { ok: true, data: { groupId, inviteCode } };
    } catch (err) {
      if (!isInviteCodeCollision(err)) throw err;
    }
  }
  return { ok: false, error: "Could not create the group, please try again" };
}

/** Joins by invite code. Joining twice is a no-op that still succeeds. */
export async function joinGroup(
  userId: string,
  input: unknown,
): Promise<ActionResult<{ groupId: string; alreadyMember: boolean }>> {
  const parsed = joinGroupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "That invite code does not look right",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const db = getDb();
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.inviteCode, parsed.data.code))
    .limit(1);
  if (!group) return { ok: false, error: "No group has that invite code" };

  const inserted = await db
    .insert(memberships)
    .values({ groupId: group.id, userId, role: "member" })
    .onConflictDoNothing()
    .returning({ userId: memberships.userId });
  return { ok: true, data: { groupId: group.id, alreadyMember: inserted.length === 0 } };
}
