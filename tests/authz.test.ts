import { beforeEach, describe, expect, it, vi } from "vitest";

const GROUP = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";
const SESSION = "9a1c7e22-0b3d-4f5a-8e61-5c2d7f9b3a10";

const limit = vi.fn<() => Promise<unknown[]>>();
const chain: Record<string, unknown> = {};
for (const m of ["select", "from", "where", "leftJoin"]) chain[m] = vi.fn(() => chain);
chain.limit = limit;
vi.mock("@/lib/db", () => ({ getDb: () => chain }));

const requireUser = vi.fn();
vi.mock("@/lib/auth/server", () => ({ requireUser: (p?: string) => requireUser(p) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import { canSeeSession, requireMember } from "@/lib/authz";

beforeEach(() => {
  limit.mockReset();
  requireUser.mockReset();
  requireUser.mockResolvedValue({ id: "u1", email: "a@b.c", name: "Ann" });
});

describe("requireMember", () => {
  it("returns a ctx for a member", async () => {
    limit.mockResolvedValue([{ role: "owner" }]);
    await expect(requireMember(GROUP)).resolves.toEqual({
      userId: "u1",
      groupId: GROUP,
      role: "owner",
    });
    expect(requireUser).toHaveBeenCalledWith("/groups/" + GROUP);
  });

  it("404s for a non-member", async () => {
    limit.mockResolvedValue([]);
    await expect(requireMember(GROUP)).rejects.toThrow("NOT_FOUND");
  });

  it("404s for a bad UUID without querying the database", async () => {
    await expect(requireMember("not-a-uuid")).rejects.toThrow("NOT_FOUND");
    expect(limit).not.toHaveBeenCalled();
  });
});

describe("canSeeSession", () => {
  it("is true when the query finds a row", async () => {
    limit.mockResolvedValue([{ id: SESSION }]);
    expect(await canSeeSession("u1", SESSION)).toBe(true);
  });

  it("is false when no row matches (other group, or before joining)", async () => {
    limit.mockResolvedValue([]);
    expect(await canSeeSession("u1", SESSION)).toBe(false);
  });

  it("is false for a bad UUID without querying", async () => {
    expect(await canSeeSession("u1", "nope")).toBe(false);
    expect(limit).not.toHaveBeenCalled();
  });
});
