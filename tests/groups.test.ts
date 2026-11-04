import { beforeEach, describe, expect, it, vi } from "vitest";

const GROUP = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";

const state = {
  selectRows: [] as unknown[],
  insertRows: [] as unknown[],
  txFail: [] as unknown[],
};
const txInserts: unknown[] = [];
const joinValues = vi.fn();

function selectChain() {
  const c: Record<string, unknown> = {};
  for (const m of ["from", "where", "innerJoin", "leftJoin", "groupBy", "orderBy"]) c[m] = () => c;
  c.limit = async () => state.selectRows;
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(state.selectRows).then(res);
  return c;
}
const db = {
  select: () => selectChain(),
  insert: () => ({
    values: (v: unknown) => {
      joinValues(v);
      return { onConflictDoNothing: () => ({ returning: async () => state.insertRows }) };
    },
  }),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const err = state.txFail.shift();
    if (err) throw err;
    const tx = {
      insert: () => ({
        values: (v: unknown) => {
          txInserts.push(v);
          return {
            returning: async () => [{ id: GROUP }],
            then: (r: (x: unknown) => unknown) => r(undefined),
          };
        },
      }),
    };
    return fn(tx);
  }),
};
vi.mock("@/lib/db", () => ({ getDb: () => db }));

import { createGroup, getGroupByInviteCode, joinGroup } from "@/server/groups";

beforeEach(() => {
  state.selectRows = [];
  state.insertRows = [];
  state.txFail = [];
  txInserts.length = 0;
  joinValues.mockClear();
  db.transaction.mockClear();
});

describe("createGroup", () => {
  it("rejects bad input", async () => {
    expect((await createGroup("u1", { name: "  ", type: "friends" })).ok).toBe(false);
    expect((await createGroup("u1", { name: "x".repeat(41), type: "friends" })).ok).toBe(false);
    expect((await createGroup("u1", { name: "ok", type: "other" })).ok).toBe(false);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("creates the group and an owner membership", async () => {
    const res = await createGroup("u1", { name: " Study Crew ", type: "class" });
    expect(res).toMatchObject({ ok: true, data: { groupId: GROUP } });
    expect(txInserts[0]).toMatchObject({ name: "Study Crew", type: "class", createdBy: "u1" });
    expect(txInserts[1]).toEqual({ groupId: GROUP, userId: "u1", role: "owner" });
  });

  it("retries on an invite code collision", async () => {
    state.txFail = [{ code: "23505" }, { cause: { code: "23505" } }];
    const res = await createGroup("u1", { name: "a", type: "friends" });
    expect(res.ok).toBe(true);
    expect(db.transaction).toHaveBeenCalledTimes(3);
  });

  it("rethrows other errors", async () => {
    state.txFail = [new Error("boom")];
    await expect(createGroup("u1", { name: "a", type: "friends" })).rejects.toThrow("boom");
  });
});

describe("joinGroup", () => {
  it("rejects a malformed code without querying", async () => {
    const res = await joinGroup("u1", "abc");
    expect(res.ok).toBe(false);
    expect(joinValues).not.toHaveBeenCalled();
  });

  it("errors on an unknown code", async () => {
    state.selectRows = [];
    expect(await joinGroup("u1", "ABCD2345")).toEqual({
      ok: false,
      error: "No group found for that code",
    });
  });

  it("joins once, then does nothing the second time", async () => {
    state.selectRows = [{ id: GROUP }];
    state.insertRows = [{ userId: "u1" }];
    expect(await joinGroup("u1", "abcd-2345")).toEqual({
      ok: true,
      data: { groupId: GROUP, joined: true },
    });
    state.insertRows = []; // conflict: no row inserted
    expect(await joinGroup("u1", "ABCD2345")).toEqual({
      ok: true,
      data: { groupId: GROUP, joined: false },
    });
  });
});

describe("getGroupByInviteCode", () => {
  it("returns null for malformed codes and unknown groups", async () => {
    expect(await getGroupByInviteCode("x")).toBeNull();
    state.selectRows = [];
    expect(await getGroupByInviteCode("ABCD2345")).toBeNull();
  });

  it("returns the preview", async () => {
    state.selectRows = [{ name: "Crew", type: "class", memberCount: 3 }];
    expect(await getGroupByInviteCode("abcd2345")).toEqual({
      name: "Crew",
      type: "class",
      memberCount: 3,
    });
  });
});
