import { and, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { GroupCtx } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { memberships, profiles, reactions, studySessions } from "@/lib/db/schema";

export const FEED_PAGE_SIZE = 20;

export const REACTION_KINDS = ["fire", "clap", "brain", "muscle"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export type FeedItem = {
  id: string;
  userId: string;
  displayName: string;
  subject: string | null;
  minutes: number;
  endedAt: Date;
  hasPhoto: boolean;
  /** Count per kind. Every kind is present, with 0 when unused. */
  reactionCounts: Record<ReactionKind, number>;
  /** Kinds the viewer has used on this check-in. */
  myReactions: ReactionKind[];
};

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

export class InvalidCursorError extends Error {
  constructor() {
    super("Invalid cursor");
    this.name = "InvalidCursorError";
  }
}

type CursorParts = { endedAt: string; id: string };

// Postgres timestamptz text, e.g. "2026-11-03 10:00:00.123456+00". We keep the
// database's own text (microsecond precision) so keyset comparison never loses
// digits the way a JS Date (milliseconds) would.
const endedAtTextSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:?\d{2})?|Z)$/);
const cursorSchema = z.object({ endedAt: endedAtTextSchema, id: z.uuid() });

export function encodeCursor(parts: CursorParts): string {
  return Buffer.from(JSON.stringify([parts.endedAt, parts.id])).toString("base64url");
}

/** Throws InvalidCursorError for anything that is not a cursor we produced. */
export function decodeCursor(cursor: string): CursorParts {
  try {
    const raw: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(raw) || raw.length !== 2) throw new InvalidCursorError();
    const parsed = cursorSchema.safeParse({ endedAt: raw[0], id: raw[1] });
    if (!parsed.success) throw new InvalidCursorError();
    return parsed.data;
  } catch {
    throw new InvalidCursorError();
  }
}

/**
 * One page of finished check-ins by members of the group, newest first.
 * A check-in is visible only if it ended at or after its owner joined this group.
 */
export async function getFeed(ctx: GroupCtx, cursor?: string): Promise<FeedPage> {
  const after = cursor ? decodeCursor(cursor) : null;
  const db = getDb();

  const rows = await db
    .select({
      id: studySessions.id,
      userId: studySessions.userId,
      displayName: profiles.displayName,
      subject: studySessions.subject,
      minutes: studySessions.minutes,
      endedAt: studySessions.endedAt,
      endedAtText: sql<string>`${studySessions.endedAt}::text`,
      hasPhoto: sql<boolean>`${studySessions.photoKey} is not null`,
    })
    .from(studySessions)
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, studySessions.userId),
        eq(memberships.groupId, ctx.groupId),
      ),
    )
    .innerJoin(profiles, eq(profiles.userId, studySessions.userId))
    .where(
      and(
        isNotNull(studySessions.endedAt),
        gt(studySessions.minutes, 0),
        sql`${studySessions.endedAt} >= ${memberships.joinedAt}`,
        after
          ? sql`(${studySessions.endedAt}, ${studySessions.id}) < (${after.endedAt}::timestamptz, ${after.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(studySessions.endedAt), desc(studySessions.id))
    .limit(FEED_PAGE_SIZE + 1);

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
  if (page.length === 0) return { items: [], nextCursor: null };

  const reactionRows = await db
    .select({
      sessionId: reactions.sessionId,
      kind: reactions.kind,
      count: sql<number>`count(*)::int`,
      mine: sql<boolean>`bool_or(${reactions.userId} = ${ctx.userId})`,
    })
    .from(reactions)
    .where(
      inArray(
        reactions.sessionId,
        page.map((r) => r.id),
      ),
    )
    .groupBy(reactions.sessionId, reactions.kind);

  const items: FeedItem[] = page.map((r) => {
    const reactionCounts = { fire: 0, clap: 0, brain: 0, muscle: 0 };
    const myReactions: ReactionKind[] = [];
    for (const x of reactionRows) {
      if (x.sessionId !== r.id) continue;
      reactionCounts[x.kind] = x.count;
      if (x.mine) myReactions.push(x.kind);
    }
    return {
      id: r.id,
      userId: r.userId,
      displayName: r.displayName,
      subject: r.subject,
      minutes: r.minutes ?? 0,
      endedAt: r.endedAt as Date,
      hasPhoto: r.hasPhoto,
      reactionCounts,
      myReactions,
    };
  });

  const last = page[page.length - 1];
  return {
    items,
    nextCursor: hasMore ? encodeCursor({ endedAt: last.endedAtText, id: last.id }) : null,
  };
}
