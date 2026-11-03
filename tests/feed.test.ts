import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";
const SID = "9a1b2c3d-5d4a-4b7e-9c10-2a6d8e4f7b02";

const limitMock = vi.fn<() => Promise<unknown[]>>();
const groupByMock = vi.fn<() => Promise<unknown[]>>();
const whereArgs: unknown[] = [];
const joinMock = vi.fn<(a: unknown, b: unknown) => unknown>(() => chain);
const chain: Record<string, unknown> = {};
for (const m of ["select", "from", "orderBy"]) chain[m] = vi.fn(() => chain);
chain.innerJoin = joinMock;
chain.where = vi.fn((w: unknown) => {
  whereArgs.push(w);
  return chain;
});
chain.limit = limitMock;
chain.groupBy = groupByMock;
vi.mock("@/lib/db", () => ({ getDb: () => chain }));

import type { GroupCtx } from "@/lib/authz";
import {
  decodeCursor,
  encodeCursor,
  FEED_PAGE_SIZE,
  getFeed,
  InvalidCursorError,
} from "@/lib/queries/feed";

const ctx = { userId: "viewer", groupId: GID, role: "member" } as unknown as GroupCtx;
const TS = "2026-11-03 10:00:00.123456+00";
const dialect = new PgDialect();

beforeEach(() => {
  limitMock.mockReset();
  groupByMock.mockReset();
  joinMock.mockClear();
  whereArgs.length = 0;
});

describe("cursor", () => {
  it("round trips", () => {
    expect(decodeCursor(encodeCursor({ endedAt: TS, id: SID }))).toEqual({
      endedAt: TS,
      id: SID,
    });
  });

  it.each([
    "",
    "not-base64!!",
    Buffer.from("hello").toString("base64url"),
    Buffer.from(JSON.stringify(["x", SID])).toString("base64url"),
    Buffer.from(JSON.stringify([TS, "nope"])).toString("base64url"),
    Buffer.from(JSON.stringify({ a: 1 })).toString("base64url"),
  ])("rejects %j", (bad) => {
    expect(() => decodeCursor(bad)).toThrow(InvalidCursorError);
  });
});

describe("getFeed", () => {
  it("scopes the query to ctx.groupId", async () => {
    limitMock.mockResolvedValue([]);
    const res = await getFeed(ctx);
    expect(res).toEqual({ items: [], nextCursor: null });
    const where = dialect.sqlToQuery(whereArgs[0] as never);
    expect(where.sql).toContain(">=");
    const membershipJoin = dialect.sqlToQuery(joinMock.mock.calls[0][1] as never);
    expect(membershipJoin.params).toContain(GID);
  });

  it("rejects a bad cursor before touching the database", async () => {
    await expect(getFeed(ctx, "garbage")).rejects.toThrow(InvalidCursorError);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("returns a next cursor and reaction data when there is another page", async () => {
    const endedAt = new Date("2026-11-03T10:00:00Z");
    const rows = Array.from({ length: FEED_PAGE_SIZE + 1 }, (_, i) => ({
      id: i === 0 ? SID : `9a1b2c3d-5d4a-4b7e-9c10-2a6d8e4f7b${String(10 + i)}`,
      userId: "u",
      displayName: "Ann",
      subject: null,
      minutes: 30,
      endedAt,
      endedAtText: TS,
      hasPhoto: i === 0,
    }));
    limitMock.mockResolvedValue(rows);
    groupByMock.mockResolvedValue([
      { sessionId: SID, kind: "fire", count: 2, mine: true },
      { sessionId: SID, kind: "clap", count: 1, mine: false },
    ]);
    const res = await getFeed(ctx, encodeCursor({ endedAt: TS, id: SID }));
    expect(res.items).toHaveLength(FEED_PAGE_SIZE);
    expect(res.items[0].hasPhoto).toBe(true);
    expect(res.items[0].reactionCounts).toEqual({ fire: 2, clap: 1, brain: 0, muscle: 0 });
    expect(res.items[0].myReactions).toEqual(["fire"]);
    expect(res.items[1].myReactions).toEqual([]);
    expect(res.nextCursor).not.toBeNull();
    const where = dialect.sqlToQuery(whereArgs[0] as never);
    expect(where.params).toContain(SID);
  });
});
