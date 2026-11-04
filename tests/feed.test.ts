import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/neon-serverless";
import { PgDialect } from "drizzle-orm/pg-core";
import type { GroupCtx } from "@/lib/authz";

const GROUP = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";
const SID = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const ctx = { userId: "u1", groupId: GROUP, role: "member" } as GroupCtx;

const rowsQueue: unknown[][] = [];
function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ["from", "where", "innerJoin", "groupBy", "orderBy", "limit"]) c[m] = () => c;
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(rowsQueue.shift() ?? []).then(res);
  return c;
}
const mockDb = { select: () => chain() };
vi.mock("@/lib/db", () => ({ getDb: () => mockDb }));

import {
  FEED_PAGE_SIZE,
  buildFeedQuery,
  decodeFeedCursor,
  encodeFeedCursor,
  getFeed,
} from "@/server/feed";

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

describe("feed cursor", () => {
  const c = { endedAt: "2026-11-04 10:15:30.123456+00", id: SID };
  it("round-trips, keeping microseconds", () => {
    expect(decodeFeedCursor(encodeFeedCursor(c))).toEqual(c);
  });
  it("rejects garbage", () => {
    for (const bad of ["", "nope", b64([1, 2]), b64(["x", SID]), b64([c.endedAt, "not-a-uuid"])]) {
      expect(decodeFeedCursor(bad)).toBeNull();
    }
  });
});

describe("buildFeedQuery", () => {
  const real = drizzle.mock();
  const dialect = new PgDialect();
  it("is scoped by ctx.groupId and the join date, with limit page+1", () => {
    const q = dialect.sqlToQuery(buildFeedQuery(real, ctx).getSQL());
    expect(q.params).toContain(GROUP);
    expect(q.sql).toContain('"memberships"."group_id"');
    expect(q.sql).toContain('"memberships"."joined_at"');
    expect(q.params).toContain(FEED_PAGE_SIZE + 1);
  });
  it("adds the keyset condition when a cursor is given", () => {
    const cur = { endedAt: "2026-11-04 10:15:30.123456+00", id: SID };
    const q = dialect.sqlToQuery(buildFeedQuery(real, ctx, cur).getSQL());
    expect(q.params).toEqual(expect.arrayContaining([cur.endedAt, cur.id, GROUP]));
  });
});

describe("getFeed", () => {
  it("rejects a malformed cursor before querying", async () => {
    await expect(getFeed(ctx, "junk")).rejects.toThrow("Invalid feed cursor");
  });

  it("aggregates reactions and returns a cursor when more rows exist", async () => {
    const now = new Date();
    const rows = Array.from({ length: FEED_PAGE_SIZE + 1 }, (_, i) => ({
      sessionId: i === 0 ? SID : `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      userId: "u2",
      displayName: "Sam",
      subject: null,
      minutes: 30,
      endedAt: now,
      endedAtText: "2026-11-04 10:15:30.123456+00",
      hasPhoto: i === 0,
    }));
    rowsQueue.push(rows, [
      { sessionId: SID, kind: "fire", count: 2, mine: true },
      { sessionId: SID, kind: "clap", count: 1, mine: false },
    ]);
    const page = await getFeed(ctx);
    expect(page.items).toHaveLength(FEED_PAGE_SIZE);
    expect(page.items[0].reactions).toEqual({ fire: 2, clap: 1, brain: 0, muscle: 0 });
    expect(page.items[0].myReactions).toEqual(["fire"]);
    expect(page.items[1].myReactions).toEqual([]);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeFeedCursor(page.nextCursor as string)?.id).toBe(page.items[FEED_PAGE_SIZE - 1].sessionId);
  });

  it("returns no cursor when there are no rows", async () => {
    rowsQueue.push([]);
    expect(await getFeed(ctx)).toEqual({ items: [], nextCursor: null });
  });
});
