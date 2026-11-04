import { beforeEach, describe, expect, it, vi } from "vitest";

const ID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";

const state = {
  selectRows: [] as unknown[],
  insertError: null as unknown,
  insertRows: [] as unknown[],
  deleteRows: [] as unknown[],
  updateRows: [] as unknown[],
};
const calls = { insert: vi.fn(), update: vi.fn(), delete: vi.fn() };

function selectChain() {
  const c: Record<string, unknown> = {};
  for (const m of ["from", "where", "orderBy"]) c[m] = () => c;
  c.limit = async () => state.selectRows;
  return c;
}
const db = {
  select: () => selectChain(),
  insert: () => ({
    values: (v: unknown) => {
      calls.insert(v);
      return {
        returning: async () => {
          if (state.insertError) throw state.insertError;
          return state.insertRows;
        },
      };
    },
  }),
  update: () => ({
    set: (v: unknown) => {
      calls.update(v);
      return { where: () => ({ returning: async () => state.updateRows }) };
    },
  }),
  delete: () => {
    calls.delete();
    return { where: () => ({ returning: async () => state.deleteRows }) };
  },
};
vi.mock("@/lib/db", () => ({ getDb: () => db }));
const deleteObjectQuietly = vi.hoisted(() => vi.fn<(key: string | null) => Promise<void>>(async () => {}));
vi.mock("@/lib/storage", () => ({ deleteObjectQuietly }));

import {
  getMyRecentSubjects,
  startSession,
  stopSession,
  updateSubject,
} from "@/server/sessions";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000 - 500);

beforeEach(() => {
  Object.assign(state, {
    selectRows: [],
    insertError: null,
    insertRows: [],
    deleteRows: [],
    updateRows: [],
  });
  Object.values(calls).forEach((f) => f.mockClear());
  deleteObjectQuietly.mockClear();
});

describe("startSession", () => {
  it("rejects a too-long subject", async () => {
    expect((await startSession("u1", { subject: "x".repeat(61) })).ok).toBe(false);
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it("starts a session and turns a blank subject into null", async () => {
    state.insertRows = [{ id: ID }];
    const res = await startSession("u1", { subject: "  " });
    expect(res).toMatchObject({ ok: true, data: { alreadyRunning: false } });
    expect(calls.insert).toHaveBeenCalledWith({ userId: "u1", subject: null });
  });

  it("returns the running session on a double start", async () => {
    state.insertError = { cause: { code: "23505" } };
    state.selectRows = [{ id: ID, subject: "Math" }];
    const res = await startSession("u1", {});
    expect(res).toMatchObject({ ok: true, data: { alreadyRunning: true, session: { id: ID } } });
  });

  it("rethrows other database errors", async () => {
    state.insertError = new Error("boom");
    await expect(startSession("u1", {})).rejects.toThrow("boom");
  });
});

describe("stopSession", () => {
  it("rejects a bad id", async () => {
    expect((await stopSession("u1", "nope")).ok).toBe(false);
  });

  it("finds nothing for someone else's session", async () => {
    state.selectRows = [];
    const res = await stopSession("intruder", ID);
    expect(res).toEqual({ ok: false, error: "No running session found" });
    expect(calls.update).not.toHaveBeenCalled();
    expect(calls.delete).not.toHaveBeenCalled();
  });

  it("deletes a session under 1 minute and reports its photo", async () => {
    state.selectRows = [{ startedAt: new Date() }];
    state.deleteRows = [{ photoKey: "u1/abc.jpg" }];
    const res = await stopSession("u1", ID);
    expect(res).toEqual({
      ok: true,
      data: { minutes: 0, capped: false, discarded: true, orphanedPhotoKey: "u1/abc.jpg" },
    });
    expect(calls.update).not.toHaveBeenCalled();
    expect(deleteObjectQuietly).toHaveBeenCalledWith("u1/abc.jpg");
  });

  it("does not delete any photo for a normal stop", async () => {
    state.selectRows = [{ startedAt: minutesAgo(5) }];
    state.updateRows = [{ id: ID }];
    await stopSession("u1", ID);
    expect(deleteObjectQuietly).not.toHaveBeenCalled();
  });

  it("saves whole minutes", async () => {
    state.selectRows = [{ startedAt: minutesAgo(25) }];
    state.updateRows = [{ id: ID }];
    const res = await stopSession("u1", ID);
    expect(res).toMatchObject({ ok: true, data: { minutes: 25, capped: false, discarded: false } });
    expect(calls.update).toHaveBeenCalledWith(expect.objectContaining({ minutes: 25 }));
  });

  it("caps at 360 minutes", async () => {
    state.selectRows = [{ startedAt: minutesAgo(500) }];
    state.updateRows = [{ id: ID }];
    const res = await stopSession("u1", ID);
    expect(res).toMatchObject({ ok: true, data: { minutes: 360, capped: true } });
  });

  it("treats a lost race (already stopped) as not found", async () => {
    state.selectRows = [{ startedAt: minutesAgo(5) }];
    state.updateRows = [];
    expect((await stopSession("u1", ID)).ok).toBe(false);
  });
});

describe("updateSubject", () => {
  it("validates input", async () => {
    expect((await updateSubject("u1", "bad", "x")).ok).toBe(false);
    expect((await updateSubject("u1", ID, "x".repeat(61))).ok).toBe(false);
  });

  it("returns an error when the session is not the user's", async () => {
    expect(await updateSubject("u2", ID, "Math")).toEqual({ ok: false, error: "Session not found" });
  });

  it("updates the subject", async () => {
    state.updateRows = [{ subject: "Math" }];
    expect(await updateSubject("u1", ID, " Math ")).toEqual({ ok: true, data: { subject: "Math" } });
    expect(calls.update).toHaveBeenCalledWith({ subject: "Math" });
  });
});

describe("getMyRecentSubjects", () => {
  it("dedupes and keeps order", async () => {
    state.selectRows = [{ subject: "Math" }, { subject: "Bio" }, { subject: "Math" }];
    expect(await getMyRecentSubjects("u1")).toEqual(["Math", "Bio"]);
  });
});
