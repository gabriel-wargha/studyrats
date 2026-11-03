import { beforeEach, describe, expect, it, vi } from "vitest";

const GROUP = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";

const txInserts: Array<{ table: unknown; values: unknown }> = [];
const transaction = vi.fn();
const returning = vi.fn();
const onConflictDoNothing = vi.fn(() => ({ returning }));
const insertValues = vi.fn(() => ({ onConflictDoNothing, returning }));
const limit = vi.fn<() => Promise<unknown[]>>();
const selectChain: Record<string, unknown> = {};
for (const m of ["select", "from", "where", "leftJoin", "innerJoin", "groupBy"]) {
  selectChain[m] = vi.fn(() => selectChain);
}
selectChain.limit = limit;
const db = { ...selectChain, insert: vi.fn(() => ({ values: insertValues })), transaction };
vi.mock("@/lib/db", () => ({ getDb: () => db }));

const ensureProfile = vi.fn(async () => undefined);
vi.mock("@/server/profiles", () => ({ ensureProfile: (u: unknown) => (ensureProfile as (u: unknown) => Promise<void>)(u) }));
const requireUser = vi.fn();
vi.mock("@/lib/auth/server", () => ({ requireUser: (p?: string) => requireUser(p) }));

import {
  createGroup as createGroupAction,
  joinGroup as joinGroupAction,
} from "@/app/actions/groups";
import { getGroupByInviteCode } from "@/lib/queries/groups";
import { createGroup, joinGroup } from "@/server/groups";

function fakeTx() {
  return {
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        txInserts.push({ table, values });
        return { returning: async () => [{ id: GROUP }] };
      },
    }),
  };
}

beforeEach(() => {
  txInserts.length = 0;
  transaction.mockReset();
  returning.mockReset();
  limit.mockReset();
  insertValues.mockClear();
  onConflictDoNothing.mockClear();
  ensureProfile.mockClear();
  requireUser.mockReset();
  requireUser.mockResolvedValue({ id: "u1", email: "a@b.c", name: "Ann" });
  transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(fakeTx()));
});

describe("createGroup", () => {
  it("rejects bad input without touching the database", async () => {
    const res = await createGroup("u1", { name: "  ", type: "club" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.fieldErrors ?? {}).sort()).toEqual(["name", "type"]);
    expect(transaction).not.toHaveBeenCalled();
    expect((await createGroup("u1", { name: "x".repeat(41), type: "class" })).ok).toBe(false);
  });

  it("creates the group and an owner membership together", async () => {
    const res = await createGroup("u1", { name: " Study Crew ", type: "friends" });
    expect(res.ok).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(txInserts).toHaveLength(2);
    expect(txInserts[0].values).toMatchObject({
      name: "Study Crew",
      type: "friends",
      createdBy: "u1",
    });
    expect(txInserts[1].values).toEqual({ groupId: GROUP, userId: "u1", role: "owner" });
    if (res.ok) expect(res.data.inviteCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it("retries with a new code on an invite-code collision", async () => {
    const collision = Object.assign(new Error("dup"), {
      cause: { code: "23505", constraint: "groups_invite_code_unique" },
    });
    transaction.mockRejectedValueOnce(collision);
    const res = await createGroup("u1", { name: "Crew", type: "class" });
    expect(res.ok).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("does not swallow other errors", async () => {
    transaction.mockRejectedValue(new Error("db down"));
    await expect(createGroup("u1", { name: "Crew", type: "class" })).rejects.toThrow("db down");
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("gives up after repeated collisions", async () => {
    transaction.mockRejectedValue({ code: "23505" });
    const res = await createGroup("u1", { name: "Crew", type: "class" });
    expect(res.ok).toBe(false);
    expect(transaction).toHaveBeenCalledTimes(5);
  });
});

describe("joinGroup", () => {
  it("rejects a malformed code", async () => {
    expect((await joinGroup("u1", { code: "abc" })).ok).toBe(false);
    expect(limit).not.toHaveBeenCalled();
  });

  it("errors on an unknown code", async () => {
    limit.mockResolvedValue([]);
    expect(await joinGroup("u1", { code: "abcd1234" })).toMatchObject({ ok: false });
  });

  it("joins as a member using the cleaned-up code", async () => {
    limit.mockResolvedValue([{ id: GROUP }]);
    returning.mockResolvedValue([{ userId: "u1" }]);
    const res = await joinGroup("u1", { code: "abcd-1234" });
    expect(res).toEqual({ ok: true, data: { groupId: GROUP, alreadyMember: false } });
    expect(insertValues).toHaveBeenCalledWith({ groupId: GROUP, userId: "u1", role: "member" });
  });

  it("joining twice does nothing and still succeeds", async () => {
    limit.mockResolvedValue([{ id: GROUP }]);
    returning.mockResolvedValue([]);
    const res = await joinGroup("u1", { code: "ABCD1234" });
    expect(res).toEqual({ ok: true, data: { groupId: GROUP, alreadyMember: true } });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });
});

describe("getGroupByInviteCode", () => {
  it("returns null for a bad code without querying", async () => {
    expect(await getGroupByInviteCode("nope")).toBeNull();
    expect(limit).not.toHaveBeenCalled();
  });

  it("returns only name, type and member count", async () => {
    limit.mockResolvedValue([{ name: "Crew", type: "class", memberCount: 3 }]);
    expect(await getGroupByInviteCode("ABCD1234")).toEqual({
      name: "Crew",
      type: "class",
      memberCount: 3,
    });
  });
});

describe("actions", () => {
  it("createGroup requires the user, ensures a profile, then delegates", async () => {
    const res = await createGroupAction({ name: "Crew", type: "friends" });
    expect(res.ok).toBe(true);
    expect(requireUser).toHaveBeenCalled();
    expect(ensureProfile).toHaveBeenCalledWith({ id: "u1", email: "a@b.c", name: "Ann" });
  });

  it("joinGroup requires the user and ensures a profile", async () => {
    limit.mockResolvedValue([{ id: GROUP }]);
    returning.mockResolvedValue([{ userId: "u1" }]);
    expect((await joinGroupAction({ code: "ABCD1234" })).ok).toBe(true);
    expect(ensureProfile).toHaveBeenCalled();
  });
});
