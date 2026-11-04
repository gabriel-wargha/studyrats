import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";

const orderByMock = vi.fn<() => Promise<unknown[]>>();
const joinArgs: unknown[][] = [];
const whereArgs: unknown[] = [];
const chain: Record<string, unknown> = {};
for (const m of ["select", "from", "groupBy"]) chain[m] = vi.fn(() => chain);
chain.innerJoin = vi.fn(() => chain);
chain.leftJoin = vi.fn((...a: unknown[]) => {
  joinArgs.push(a);
  return chain;
});
chain.where = vi.fn((w: unknown) => {
  whereArgs.push(w);
  return chain;
});
chain.orderBy = orderByMock;
vi.mock("@/lib/db", () => ({ getDb: () => chain }));

import type { GroupCtx } from "@/lib/authz";
import { getLeaderboard } from "@/lib/queries/leaderboard";
import { currentWeekRange } from "@/lib/week";

const ctx = { userId: "me", groupId: GID, role: "member" } as unknown as GroupCtx;
const dialect = new PgDialect();
const NOW = new Date("2026-11-04T18:00:00Z");

beforeEach(() => {
  orderByMock.mockReset();
  joinArgs.length = 0;
  whereArgs.length = 0;
});

describe("getLeaderboard", () => {
  it("week: filters by the Boise week range and the joined_at rule, scoped to the group", async () => {
    orderByMock.mockResolvedValue([]);
    await getLeaderboard(ctx, "week", NOW);
    const { start, end } = currentWeekRange(NOW);
    const on = dialect.sqlToQuery(joinArgs[0][1] as never);
    expect(on.sql).toContain('"joined_at"');
    expect(on.params).toContain(start.toISOString());
    expect(on.params).toContain(end.toISOString());
    const where = dialect.sqlToQuery(whereArgs[0] as never);
    expect(where.params).toContain(GID);
  });

  it("all: has the joined_at rule but no week bounds", async () => {
    orderByMock.mockResolvedValue([]);
    await getLeaderboard(ctx, "all", NOW);
    const on = dialect.sqlToQuery(joinArgs[0][1] as never);
    expect(on.sql).toContain('"joined_at"');
    const { start, end } = currentWeekRange(NOW);
    expect(on.params).not.toContain(start.toISOString());
    expect(on.params).not.toContain(end.toISOString());
  });

  it("includes zero-point members and ranks ties together", async () => {
    orderByMock.mockResolvedValue([
      { userId: "a", displayName: "Ann", minutes: 90 },
      { userId: "b", displayName: "Bo", minutes: 30 },
      { userId: "c", displayName: "Cy", minutes: 30 },
      { userId: "d", displayName: "Di", minutes: 0 },
    ]);
    const rows = await getLeaderboard(ctx, "all");
    expect(rows.map((r) => [r.userId, r.points, r.rank])).toEqual([
      ["a", 90, 1],
      ["b", 30, 2],
      ["c", 30, 2],
      ["d", 0, 4],
    ]);
  });
});
