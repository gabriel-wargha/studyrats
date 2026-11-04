import { and, desc, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { GroupCtx } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { memberships, profiles, reactions, studySessions } from "@/lib/db/schema";

/** Only `select` is needed, so tests can pass an unconnected `drizzle.mock()`. */
type Db = Pick<ReturnType<typeof getDb>, "select">;

export const FEED_PAGE_SIZE = 20;

export type ReactionKind = (typeof reactions.$inferSelect)["kind"];
export const REACTION_KINDS: readonly ReactionKind[] = ["fire", "clap", "brain", "muscle"];

export type FeedCursor = { endedAt: string; id: string };

export type FeedItem = {
  sessionId: string;
  userId: string;
  displayName: string;
  subject: string | null;
  minutes: number;
  endedAt: Date;
  hasPhoto: boolean;
  /** Count per kind (all kinds present, zero when unused). */
  reactions: Record<ReactionKind, number>;
  /** Kinds the signed-in user has used on this check-in. */
  myReactions: ReactionKind[];
};

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

const uuidSchema = z.string().uuid();
// Postgres timestamptz text, e.g. "2026-11-04 10:15:30.123456+00". Kept as text
// so microseconds survive (a JS Date would truncate to milliseconds).
const endedAtTextSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}[ T][\d:.]+(Z|[+-]\d{2}(:?\d{2})?)$/);

export function encodeFeedCursor(c: FeedCursor): string {
  return Buffer.from(JSON.stringify([c.endedAt, c.id]), "utf8").toString("base64url");
}

/** Returns null for anything malformed, so a bad cursor is a clean validation error. */
export function decodeFeedCursor(raw: string): FeedCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const endedAt = endedAtTextSchema.safeParse(parsed[0]);
    const id = uuidSchema.safeParse(parsed[1]);
    if (!endedAt.success || !id.success) return null;
    return { endedAt: endedAt.data, id: id.data };
  } catch {
    return null;
  }
}

/**
 * Builds the page query without touching the database. Scoped by ctx.groupId:
 * only members' finished sessions that ended at or after they joined.
 * Fetches one extra row so the caller knows whether another page exists.
 */
export function buildFeedQuery(db: Db, ctx: GroupCtx, cursor?: FeedCursor) {
  const endedAtText = sql<string>`${studySessions.endedAt}::text`;
  const after = cursor
    ? or(
        sql`${studySessions.endedAt} < ${cursor.endedAt}::timestamptz`,
        and(
          sql`${studySessions.endedAt} = ${cursor.endedAt}::timestamptz`,
          sql`${studySessions.id} < ${cursor.id}::uuid`,
        ),
      )
    : undefined;

  return db
    .select({
      sessionId: studySessions.id,
      userId: studySessions.userId,
      displayName: profiles.displayName,
      subject: studySessions.subject,
      minutes: studySessions.minutes,
      endedAt: studySessions.endedAt,
      endedAtText,
      hasPhoto: sql<boolean>`${studySessions.photoKey} is not null`,
    })
    .from(studySessions)
    .innerJoin(
      memberships,
      and(eq(memberships.userId, studySessions.userId), eq(memberships.groupId, ctx.groupId)),
    )
    .innerJoin(profiles, eq(profiles.userId, studySessions.userId))
    .where(and(isNotNull(studySessions.endedAt), gte(studySessions.endedAt, memberships.joinedAt), after))
    .orderBy(desc(studySessions.endedAt), desc(studySessions.id))
    .limit(FEED_PAGE_SIZE + 1);
}

function emptyCounts(): Record<ReactionKind, number> {
  return { fire: 0, clap: 0, brain: 0, muscle: 0 };
}

/** One page of check-ins for the group, newest first. `cursor` comes from a previous nextCursor. */
export async function getFeed(ctx: GroupCtx, cursor?: string): Promise<FeedPage> {
  let decoded: FeedCursor | undefined;
  if (cursor !== undefined) {
    const d = decodeFeedCursor(cursor);
    if (!d) throw new Error("Invalid feed cursor");
    decoded = d;
  }

  const db = getDb();
  const rows = await buildFeedQuery(db, ctx, decoded);

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
  if (page.length === 0) return { items: [], nextCursor: null };

  const ids = page.map((r) => r.sessionId);
  const agg = await db
    .select({
      sessionId: reactions.sessionId,
      kind: reactions.kind,
      count: sql<number>`count(*)::int`,
      mine: sql<boolean>`bool_or(${reactions.userId} = ${ctx.userId})`,
    })
    .from(reactions)
    .where(inArray(reactions.sessionId, ids))
    .groupBy(reactions.sessionId, reactions.kind);

  const counts = new Map<string, Record<ReactionKind, number>>();
  const mine = new Map<string, ReactionKind[]>();
  for (const a of agg) {
    const c = counts.get(a.sessionId) ?? emptyCounts();
    c[a.kind] = a.count;
    counts.set(a.sessionId, c);
    if (a.mine) mine.set(a.sessionId, [...(mine.get(a.sessionId) ?? []), a.kind]);
  }

  const items: FeedItem[] = page.map((r) => ({
    sessionId: r.sessionId,
    userId: r.userId,
    displayName: r.displayName,
    subject: r.subject,
    minutes: r.minutes ?? 0,
    endedAt: r.endedAt as Date,
    hasPhoto: r.hasPhoto,
    reactions: counts.get(r.sessionId) ?? emptyCounts(),
    myReactions: mine.get(r.sessionId) ?? [],
  }));

  const last = page[page.length - 1];
  return {
    items,
    nextCursor: hasMore ? encodeFeedCursor({ endedAt: last.endedAtText, id: last.sessionId }) : null,
  };
}
