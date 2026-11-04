import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn<(n: number) => Promise<unknown[]>>();
const where = vi.fn<(w: unknown) => { limit: typeof limit }>(() => ({ limit }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where }) }) }),
}));

import { getMyProfile } from "@/lib/queries/profiles";

beforeEach(() => {
  limit.mockReset();
  where.mockClear();
});

describe("getMyProfile", () => {
  it("returns the saved display name", async () => {
    limit.mockResolvedValue([{ displayName: "Ann" }]);
    expect(await getMyProfile("u1")).toEqual({ displayName: "Ann" });
  });
  it("returns null when there is no row", async () => {
    limit.mockResolvedValue([]);
    expect(await getMyProfile("u1")).toBeNull();
  });
  it("scopes the query to the user", async () => {
    limit.mockResolvedValue([]);
    await getMyProfile("u1");
    const q = new PgDialect().sqlToQuery(where.mock.calls[0][0] as never);
    expect(q.params).toContain("u1");
  });
});
