import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const ID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";

const state = {
  selectRows: [] as unknown[],
  insertError: null as unknown,
  insertRows: [] as unknown[],
  deleteRows: [] as unknown[],
  updateRows: [] as unknown[],
};
const calls = { insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
const wheres = { select: [] as SQL[], update: [] as SQL[], delete: [] as SQL[] };
const dialect = new PgDialect();
const compile = (w: SQL | undefined) => dialect.sqlToQuery(w as SQL);
/** Asserts the where clause is scoped to the caller and the session id. */
function expectOwned(w: SQL | undefined, userId: string, sessionId: string) {
  const q = compile(w);
  expect(q.sql).toContain('"user_id"');
  expect(q.params).toContain(userId);
  expect(q.params).toContain(sessionId);
}

function selectChain() {
  const c: Record<string, unknown> = {};
  for (const m of ["from", "orderBy"]) c[m] = () => c;
  c.where = (w: SQL) => {
    wheres.select.push(w);
    return c;
  };
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
      return {
        where: (w: SQL) => {
          wheres.update.push(w);
          return { returning: async () => state.updateRows };
        },
      };
    },
  }),
  delete: () => {
    calls.delete();
    return {
      where: (w: SQL) => {
        wheres.delete.push(w);
        return { returning: async () => state.deleteRows };
      },
    };
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


beforeEach(() => {
  Object.assign(state, {
    selectRows: [],
    insertError: null,
    insertRows: [],
    deleteRows: [],
    updateRows: [],
  });
  Object.values(calls).forEach((f) => f.mockClear());
  wheres.select.length = wheres.update.length = wheres.delete.length = 0;
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
    expect(calls.update).not.toHaveBeenCalled();
  });

  it("scopes the single UPDATE to the caller, the session id and running sessions", async () => {
    state.updateRows = [{ minutes: 25, rawMinutes: 25, photoKey: null }];
    await stopSession("u1", ID);
    expect(wheres.update).toHaveLength(1);
    expectOwned(wheres.update[0], "u1", ID);
    expect(compile(wheres.update[0]).sql).toContain('"ended_at" is null');
  });

  it("computes minutes, the cap and the clock in SQL", async () => {
    state.updateRows = [{ minutes: 25, rawMinutes: 25, photoKey: null }];
    await stopSession("u1", ID);
    const set = calls.update.mock.calls[0][0] as { endedAt: SQL; minutes: SQL };
    const mins = compile(set.minutes);
    expect(mins.sql).toContain("least(floor(");
    expect(mins.sql).toContain("now()");
    expect(mins.params).toContain(360);
    expect(compile(set.endedAt).sql).toContain("now()");
  });

  it("finds nothing for someone else's session (no rows updated)", async () => {
    state.updateRows = [];
    const res = await stopSession("intruder", ID);
    expect(res).toEqual({ ok: false, error: "No running session found" });
    expectOwned(wheres.update[0], "intruder", ID);
    expect(calls.delete).not.toHaveBeenCalled();
  });

  it("deletes a session under 1 minute (scoped) and its photo", async () => {
    state.updateRows = [{ minutes: 0, rawMinutes: 0, photoKey: "u1/abc.jpg" }];
    const res = await stopSession("u1", ID);
    expect(res).toEqual({
      ok: true,
      data: { minutes: 0, capped: false, discarded: true, orphanedPhotoKey: "u1/abc.jpg" },
    });
    expect(wheres.delete).toHaveLength(1);
    expectOwned(wheres.delete[0], "u1", ID);
    expect(deleteObjectQuietly).toHaveBeenCalledWith("u1/abc.jpg");
  });

  it("does not delete anything for a normal stop", async () => {
    state.updateRows = [{ minutes: 5, rawMinutes: 5, photoKey: "u1/abc.jpg" }];
    await stopSession("u1", ID);
    expect(calls.delete).not.toHaveBeenCalled();
    expect(deleteObjectQuietly).not.toHaveBeenCalled();
  });

  it("returns whole minutes", async () => {
    state.updateRows = [{ minutes: 25, rawMinutes: 25, photoKey: null }];
    const res = await stopSession("u1", ID);
    expect(res).toMatchObject({ ok: true, data: { minutes: 25, capped: false, discarded: false } });
  });

  it("reports capped when the raw minutes exceed 360", async () => {
    state.updateRows = [{ minutes: 360, rawMinutes: 500, photoKey: null }];
    const res = await stopSession("u1", ID);
    expect(res).toMatchObject({ ok: true, data: { minutes: 360, capped: true } });
  });

  it("does not report capped at exactly 360", async () => {
    state.updateRows = [{ minutes: 360, rawMinutes: 360, photoKey: null }];
    expect(await stopSession("u1", ID)).toMatchObject({ ok: true, data: { capped: false } });
  });
});

describe("updateSubject", () => {
  it("validates input", async () => {
    expect((await updateSubject("u1", "bad", "x")).ok).toBe(false);
    expect((await updateSubject("u1", ID, "x".repeat(61))).ok).toBe(false);
  });

  it("returns an error when the session is not the user's", async () => {
    expect(await updateSubject("u2", ID, "Math")).toEqual({ ok: false, error: "Session not found" });
    expectOwned(wheres.update[0], "u2", ID);
  });

  it("updates the subject", async () => {
    state.updateRows = [{ subject: "Math" }];
    expect(await updateSubject("u1", ID, " Math ")).toEqual({ ok: true, data: { subject: "Math" } });
    expect(calls.update).toHaveBeenCalledWith({ subject: "Math" });
    expectOwned(wheres.update[0], "u1", ID);
  });
});

describe("getMyRecentSubjects", () => {
  it("dedupes and keeps order", async () => {
    state.selectRows = [{ subject: "Math" }, { subject: "Bio" }, { subject: "Math" }];
    expect(await getMyRecentSubjects("u1")).toEqual(["Math", "Bio"]);
  });
});
