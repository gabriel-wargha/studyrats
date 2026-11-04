import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";

const state = { deleted: [] as unknown[] };
const calls = { insert: vi.fn(), conflict: vi.fn() };
const db = {
  delete: () => ({ where: () => ({ returning: async () => state.deleted }) }),
  insert: () => ({
    values: (v: unknown) => {
      calls.insert(v);
      return { onConflictDoNothing: async () => calls.conflict() };
    },
  }),
};
vi.mock("@/lib/db", () => ({ getDb: () => db }));

const authz = vi.hoisted(() => ({ canSeeSession: vi.fn() }));
vi.mock("@/lib/authz", () => authz);

import { toggleReaction } from "@/server/reactions";

beforeEach(() => {
  state.deleted = [];
  calls.insert.mockClear();
  calls.conflict.mockClear();
  authz.canSeeSession.mockReset();
  authz.canSeeSession.mockResolvedValue(true);
});

describe("toggleReaction", () => {
  it("turns a reaction on when none exists", async () => {
    const res = await toggleReaction("u1", { sessionId: SID, kind: "fire" });
    expect(res).toEqual({ ok: true, data: { sessionId: SID, kind: "fire", active: true } });
    expect(calls.insert).toHaveBeenCalledWith({ sessionId: SID, userId: "u1", kind: "fire" });
    expect(authz.canSeeSession).toHaveBeenCalledWith("u1", SID);
  });

  it("turns it off when it already exists", async () => {
    state.deleted = [{ kind: "fire" }];
    const res = await toggleReaction("u1", { sessionId: SID, kind: "fire" });
    expect(res).toEqual({ ok: true, data: { sessionId: SID, kind: "fire", active: false } });
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it("fails for a session the user cannot see", async () => {
    authz.canSeeSession.mockResolvedValue(false);
    expect(await toggleReaction("intruder", { sessionId: SID, kind: "clap" })).toEqual({
      ok: false,
      error: "Session not found",
    });
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it("validates input before touching anything", async () => {
    for (const bad of [null, {}, { sessionId: "nope", kind: "fire" }, { sessionId: SID, kind: "poop" }]) {
      expect((await toggleReaction("u1", bad)).ok).toBe(false);
    }
    expect(authz.canSeeSession).not.toHaveBeenCalled();
  });
});
