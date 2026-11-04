import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { GroupCtx } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { groups, memberships, profiles, studySessions } from "@/lib/db/schema";
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from "@/lib/invite-code";
import { currentWeekRange } from "@/lib/week";

export type GroupType = (typeof groups.$inferSelect)["type"];

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(40, "Name is at most 40 characters"),
  type: z.enum(["friends", "class"], { error: "Pick friends or class" }),
});

export const inviteCodeSchema = z
  .string()
  .transform(normalizeInviteCode)
  .refine(isValidInviteCode, "That invite code does not look right");

export type ServerResult<T> = { ok: true; data: T } | { ok: false; error: string };

const MAX_CODE_ATTEMPTS = 5;

/** Postgres unique violation (23505), possibly wrapped by drizzle in `cause`. */
function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e && typeof e === "object"; i++) {
    if ((e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** Groups the user belongs to, with their points this week in each. */
export async function getMyGroups(userId: string) {
  const { start, end } = currentWeekRange();
  const weeklyPoints = sql<number>`coalesce(sum(${studySessions.minutes}), 0)::int`;
  return getDb()
    .select({
      id: groups.id,
      name: groups.name,
      type: groups.type,
      weeklyPoints,
    })
    .from(memberships)
    .innerJoin(groups, eq(groups.id, memberships.groupId))
    .leftJoin(
      studySessions,
      and(
        eq(studySessions.userId, memberships.userId),
        gte(studySessions.endedAt, memberships.joinedAt),
        gte(studySessions.endedAt, start),
        lt(studySessions.endedAt, end),
      ),
    )
    .where(eq(memberships.userId, userId))
    .groupBy(groups.id, groups.name, groups.type, memberships.joinedAt)
    .orderBy(asc(groups.name));
}

/** Header data for a group the caller belongs to (the invite code is for members only). */
export async function getGroupHeader(ctx: GroupCtx) {
  const [row] = await getDb()
    .select({
      id: groups.id,
      name: groups.name,
      type: groups.type,
      inviteCode: groups.inviteCode,
    })
    .from(groups)
    .where(eq(groups.id, ctx.groupId))
    .limit(1);
  return row ? { ...row, role: ctx.role } : null;
}

export async function getMembers(ctx: GroupCtx) {
  return getDb()
    .select({
      userId: memberships.userId,
      displayName: profiles.displayName,
      role: memberships.role,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(profiles, eq(profiles.userId, memberships.userId))
    .where(eq(memberships.groupId, ctx.groupId))
    .orderBy(asc(memberships.joinedAt), asc(profiles.displayName));
}

/**
 * Public preview for the join screen: only name, type and member count.
 * Returns null for a malformed or unknown code.
 */
export async function getGroupByInviteCode(code: string) {
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return null;
  const memberCount = sql<number>`(select count(*)::int from ${memberships} where ${memberships.groupId} = ${groups.id})`;
  const [row] = await getDb()
    .select({ name: groups.name, type: groups.type, memberCount })
    .from(groups)
    .where(eq(groups.inviteCode, parsed.data))
    .limit(1);
  return row ?? null;
}

/** Creates a group and the creator's owner membership in one transaction. */
export async function createGroup(
  userId: string,
  input: unknown,
): Promise<ServerResult<{ groupId: string; inviteCode: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      const groupId = await getDb().transaction(async (tx) => {
        const [g] = await tx
          .insert(groups)
          .values({ name: parsed.data.name, type: parsed.data.type, inviteCode, createdBy: userId })
          .returning({ id: groups.id });
        await tx.insert(memberships).values({ groupId: g.id, userId, role: "owner" });
        return g.id;
      });
      return { ok: true, data: { groupId, inviteCode } };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // code collision: try a new code
    }
  }
  return { ok: false, error: "Could not create the group. Please try again." };
}

/** Joins by invite code. Idempotent: joining twice changes nothing. */
export async function joinGroup(
  userId: string,
  code: unknown,
): Promise<ServerResult<{ groupId: string; joined: boolean }>> {
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid code" };

  const db = getDb();
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.inviteCode, parsed.data))
    .limit(1);
  if (!group) return { ok: false, error: "No group found for that code" };

  const inserted = await db
    .insert(memberships)
    .values({ groupId: group.id, userId, role: "member" })
    .onConflictDoNothing({ target: [memberships.groupId, memberships.userId] })
    .returning({ userId: memberships.userId });
  return { ok: true, data: { groupId: group.id, joined: inserted.length > 0 } };
}
