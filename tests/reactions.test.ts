import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";
const GID = "9a1b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b02";

const deleteReturning = vi.fn<() => Promise<unknown[]>>();
const insertConflict = vi.fn();
const insertValues = vi.fn();
const db = {
  delete: () => ({ where: () => ({ returning: deleteReturning }) }),
  insert: () => ({
    values: (v: unknown) => {
      insertValues(v);
      return { onConflictDoNothing: insertConflict };
    },
  }),
};
vi.mock("@/lib/db", () => ({ getDb: () => db }));

const canSeeSession = vi.fn();
const requireMember = vi.fn();
vi.mock("@/lib/authz", () => ({
  canSeeSession: (...a: unknown[]) => canSeeSession(...a),
  requireMember: (...a: unknown[]) => requireMember(...a),
}));
const getFeed = vi.fn();
vi.mock("@/lib/queries/feed", async (orig) => ({
  ...(await orig<typeof import("@/lib/queries/feed")>()),
  getFeed: (...a: unknown[]) => getFeed(...a),
}));
vi.mock("@/lib/auth/server", () => ({
  requireUser: async () => ({ id: "u1", name: "U", email: "u@x.com" }),
}));
vi.mock("@/server/profiles", () => ({ ensureProfile: vi.fn() }));

import { loadMoreFeed, toggleReaction as toggleAction } from "@/app/actions/reactions";
import { InvalidCursorError } from "@/lib/queries/feed";
import { loadFeedPage, toggleReaction } from "@/server/reactions";

beforeEach(() => {
  vi.clearAllMocks();
  canSeeSession.mockResolvedValue(true);
});

describe("toggleReaction", () => {
  it("turns a reaction on when none exists", async () => {
    deleteReturning.mockResolvedValue([]);
    const res = await toggleReaction("u1", { sessionId: SID, kind: "fire" });
    expect(res).toEqual({ ok: true, data: { active: true } });
    expect(insertValues).toHaveBeenCalledWith({ sessionId: SID, userId: "u1", kind: "fire" });
  });

  it("turns it off when it exists", async () => {
    deleteReturning.mockResolvedValue([{ sessionId: SID }]);
    const res = await toggleReaction("u1", { sessionId: SID, kind: "fire" });
    expect(res).toEqual({ ok: true, data: { active: false } });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("fails for a session the user cannot see", async () => {
    canSeeSession.mockResolvedValue(false);
    const res = await toggleReaction("u1", { sessionId: SID, kind: "fire" });
    expect(res).toMatchObject({ ok: false, error: "Check-in not found" });
    expect(deleteReturning).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
    expect(canSeeSession).toHaveBeenCalledWith("u1", SID);
  });

  it("rejects bad input without touching the database", async () => {
    expect((await toggleReaction("u1", { sessionId: "nope", kind: "fire" })).ok).toBe(false);
    expect((await toggleReaction("u1", { sessionId: SID, kind: "poop" })).ok).toBe(false);
    expect(canSeeSession).not.toHaveBeenCalled();
  });

  it("the action passes the signed-in user id", async () => {
    deleteReturning.mockResolvedValue([]);
    await toggleAction({ sessionId: SID, kind: "clap" });
    expect(canSeeSession).toHaveBeenCalledWith("u1", SID);
  });
});

describe("loadFeedPage / loadMoreFeed", () => {
  const ctx = { userId: "u1", groupId: GID, role: "member" };

  it("returns the page", async () => {
    getFeed.mockResolvedValue({ items: [], nextCursor: null });
    expect(await loadFeedPage(ctx as never, "c")).toEqual({
      ok: true,
      data: { items: [], nextCursor: null },
    });
    expect(getFeed).toHaveBeenCalledWith(ctx, "c");
  });

  it("turns a bad cursor into an error result", async () => {
    getFeed.mockRejectedValue(new InvalidCursorError());
    const res = await loadFeedPage(ctx as never, "garbage");
    expect(res.ok).toBe(false);
  });

  it("rethrows unexpected errors", async () => {
    getFeed.mockRejectedValue(new Error("db down"));
    await expect(loadFeedPage(ctx as never)).rejects.toThrow("db down");
  });

  it("the action checks membership first and reports a bad cursor", async () => {
    requireMember.mockResolvedValue(ctx);
    getFeed.mockRejectedValue(new InvalidCursorError());
    const res = await loadMoreFeed({ groupId: GID, cursor: "garbage" });
    expect(requireMember).toHaveBeenCalledWith(GID);
    expect(res.ok).toBe(false);
  });

  it("the action does not read data when membership fails", async () => {
    requireMember.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(loadMoreFeed({ groupId: GID })).rejects.toThrow();
    expect(getFeed).not.toHaveBeenCalled();
  });
});
