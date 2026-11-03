import { and, asc, count, eq, gte, lt, sql } from "drizzle-orm";
import type { GroupCtx } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { groups, memberships, profiles, studySessions } from "@/lib/db/schema";
import { inviteCodeSchema } from "@/lib/schemas/groups";
import { currentWeekRange } from "@/lib/week";

/** The groups the user belongs to, with their points for this week. */
export async function getMyGroups(userId: string, now: Date = new Date()) {
  const { start, end } = currentWeekRange(now);
  const weeklyPoints = sql<number>`coalesce(sum(${studySessions.minutes}), 0)::int`;
  return getDb()
    .select({
      id: groups.id,
      name: groups.name,
      type: groups.type,
      role: memberships.role,
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
    .groupBy(groups.id, groups.name, groups.type, memberships.role)
    .orderBy(asc(groups.name));
}

/** Header data for a group the caller belongs to. */
export async function getGroupHeader(ctx: GroupCtx) {
  const [row] = await getDb()
    .select({
      id: groups.id,
      name: groups.name,
      type: groups.type,
      inviteCode: groups.inviteCode,
      memberCount: sql<number>`(select count(*)::int from ${memberships} where ${memberships.groupId} = ${groups.id})`,
    })
    .from(groups)
    .where(eq(groups.id, ctx.groupId))
    .limit(1);
  return row ?? null;
}

/** Everyone in the group, owner first then by join date. */
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
    .orderBy(sql`${memberships.role} = 'owner' desc`, asc(memberships.joinedAt));
}

/**
 * Preview for the join screen. Exposes only name, type and member count, never
 * the group id or member list. Returns null for a bad or unknown code.
 */
export async function getGroupByInviteCode(rawCode: string) {
  const parsed = inviteCodeSchema.safeParse(rawCode);
  if (!parsed.success) return null;
  const [row] = await getDb()
    .select({ name: groups.name, type: groups.type, memberCount: count(memberships.userId) })
    .from(groups)
    .leftJoin(memberships, eq(memberships.groupId, groups.id))
    .where(eq(groups.inviteCode, parsed.data))
    .groupBy(groups.id, groups.name, groups.type)
    .limit(1);
  return row ?? null;
}
