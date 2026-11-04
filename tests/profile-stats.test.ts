import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const returning = vi.fn<() => Promise<unknown[]>>();
const set = vi.fn<(v: unknown) => unknown>();
const whereUpdate = vi.fn(() => ({ returning }));
const whereSelect = vi.fn<(w: unknown) => Promise<unknown[]>>();
const db = {
  update: () => ({
    set: (v: unknown) => {
      set(v);
      return { where: whereUpdate };
    },
  }),
  select: () => ({ from: () => ({ where: whereSelect }) }),
};
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/lib/auth/server", () => ({
  requireUser: async () => ({ id: "u1", name: "U", email: "u@x.com" }),
}));
vi.mock("@/server/groups", () => ({}));

import { updateDisplayName as updateAction } from "@/app/actions/profiles";
import { getMyStats } from "@/lib/queries/stats";
import { updateDisplayNameSchema } from "@/lib/schemas/profiles";
import { updateDisplayName } from "@/server/profiles";

beforeEach(() => {
  returning.mockReset();
  set.mockReset();
  whereSelect.mockReset();
});

describe("updateDisplayNameSchema", () => {
  it("trims", () => {
    expect(updateDisplayNameSchema.parse({ displayName: "  Ann " }).displayName).toBe("Ann");
  });
  it("rejects empty, blank, too long and non-strings", () => {
    for (const v of ["", "   ", "x".repeat(41), 5, undefined]) {
      expect(updateDisplayNameSchema.safeParse({ displayName: v }).success).toBe(false);
    }
  });
  it("allows exactly 40 characters", () => {
    expect(updateDisplayNameSchema.safeParse({ displayName: "x".repeat(40) }).success).toBe(true);
  });
});

describe("updateDisplayName", () => {
  it("returns an error and does not touch the db on bad input", async () => {
    const res = await updateDisplayName("u1", { displayName: " " });
    expect(res.ok).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });
  it("updates the caller's profile", async () => {
    returning.mockResolvedValue([{ displayName: "Ann" }]);
    const res = await updateDisplayName("u1", { displayName: " Ann " });
    expect(set).toHaveBeenCalledWith({ displayName: "Ann" });
    expect(res).toEqual({ ok: true, data: { displayName: "Ann" } });
  });
  it("fails when there is no profile row", async () => {
    returning.mockResolvedValue([]);
    expect((await updateDisplayName("u1", { displayName: "Ann" })).ok).toBe(false);
  });
  it("action rejects garbage input", async () => {
    const insert = { values: () => ({ onConflictDoNothing: async () => undefined }) };
    (db as Record<string, unknown>).insert = () => insert;
    expect((await updateAction(null)).ok).toBe(false);
  });
});

describe("getMyStats", () => {
  it("returns week and all-time points", async () => {
    whereSelect.mockResolvedValue([{ week: 90, all: 400 }]);
    expect(await getMyStats("u1", new Date("2026-11-04T18:00:00Z"))).toEqual({
      weekPoints: 90,
      allTimePoints: 400,
    });
  });
  it("is zero with no sessions", async () => {
    whereSelect.mockResolvedValue([{ week: 0, all: 0 }]);
    expect(await getMyStats("u1")).toEqual({ weekPoints: 0, allTimePoints: 0 });
  });
  it("scopes the query to the user", async () => {
    whereSelect.mockResolvedValue([]);
    await getMyStats("u1");
    const q = new PgDialect().sqlToQuery(whereSelect.mock.calls[0][0] as never);
    expect(q.params).toContain("u1");
  });
});
