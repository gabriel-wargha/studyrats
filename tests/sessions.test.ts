import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";

const insertReturning = vi.fn();
const updateReturning = vi.fn();
const deleteWhere = vi.fn(async () => undefined);
const selectLimit = vi.fn<() => Promise<unknown[]>>();
const updateSet = vi.fn();
const selectChain: Record<string, unknown> = {};
for (const m of ["select", "from", "where", "orderBy", "groupBy"]) {
  selectChain[m] = vi.fn(() => selectChain);
}
selectChain.limit = selectLimit;
const db = {
  ...selectChain,
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: insertReturning })) })),
  update: vi.fn(() => ({
    set: (v: unknown) => {
      updateSet(v);
      return { where: () => ({ returning: updateReturning }) };
    },
  })),
  delete: vi.fn(() => ({ where: deleteWhere })),
};
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/server/profiles", () => ({ ensureProfile: vi.fn(async () => undefined) }));
const requireUser = vi.fn();
vi.mock("@/lib/auth/server", () => ({ requireUser: (p?: string) => requireUser(p) }));

import { startSession as startAction, stopSession as stopAction } from "@/app/actions/sessions";
import { getMyRecentSubjects } from "@/lib/queries/sessions";
import { startSession, stopSession, updateSubject } from "@/server/sessions";

const startedAt = new Date("2026-11-03T10:00:00Z");

beforeEach(() => {
  for (const f of [insertReturning, updateReturning, deleteWhere, selectLimit, updateSet]) f.mockReset();
  db.insert.mockClear();
  db.update.mockClear();
  db.delete.mockClear();
  deleteWhere.mockResolvedValue(undefined);
  requireUser.mockReset();
  requireUser.mockResolvedValue({ id: "u1", email: "a@b.c", name: "Ann" });
});

describe("startSession", () => {
  it("creates a session and normalizes the subject", async () => {
    insertReturning.mockResolvedValue([{ id: SID, subject: "Math", startedAt }]);
    const res = await startSession("u1", { subject: "  Math " });
    expect(res).toEqual({
      ok: true,
      data: { id: SID, subject: "Math", startedAt, alreadyRunning: false },
    });
  });

  it("rejects a subject over 60 characters", async () => {
    const res = await startSession("u1", { subject: "x".repeat(61) });
    expect(res.ok).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns the running session on a double start", async () => {
    insertReturning.mockRejectedValue(
      Object.assign(new Error("failed"), {
        cause: { code: "23505", constraint: "study_sessions_one_running_per_user" },
      }),
    );
    selectLimit.mockResolvedValue([{ id: SID, subject: "Bio", startedAt }]);
    const res = await startSession("u1", {});
    expect(res).toEqual({
      ok: true,
      data: { id: SID, subject: "Bio", startedAt, alreadyRunning: true },
    });
  });

  it("rethrows other database errors", async () => {
    insertReturning.mockRejectedValue(new Error("boom"));
    await expect(startSession("u1", {})).rejects.toThrow("boom");
  });
});

describe("stopSession", () => {
  it("fails with no rows for someone else's session and deletes nothing", async () => {
    updateReturning.mockResolvedValue([]);
    const res = await stopSession("intruder", { id: SID });
    expect(res.ok).toBe(false);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("rejects a bad id", async () => {
    const res = await stopSession("u1", { id: "nope" });
    expect(res.ok).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns the minutes for a normal session", async () => {
    updateReturning.mockResolvedValue([{ minutes: 42, photoKey: null, rawMinutes: 42 }]);
    expect(await stopSession("u1", { id: SID })).toEqual({
      ok: true,
      data: { minutes: 42, capped: false },
    });
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("caps at 360 and says so", async () => {
    updateReturning.mockResolvedValue([{ minutes: 360, photoKey: null, rawMinutes: 900 }]);
    expect(await stopSession("u1", { id: SID })).toEqual({
      ok: true,
      data: { minutes: 360, capped: true },
    });
  });

  it("deletes a session under one minute", async () => {
    updateReturning.mockResolvedValue([{ minutes: 0, photoKey: "u/u1/s/x/y.jpg", rawMinutes: 0 }]);
    expect(await stopSession("u1", { id: SID })).toEqual({
      ok: true,
      data: { minutes: 0, capped: false },
    });
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});

describe("updateSubject", () => {
  it("turns an empty subject into null", async () => {
    updateReturning.mockResolvedValue([{ subject: null }]);
    const res = await updateSubject("u1", { id: SID, subject: "   " });
    expect(res).toEqual({ ok: true, data: { subject: null } });
    expect(updateSet).toHaveBeenCalledWith({ subject: null });
  });

  it("fails when the session is not the caller's", async () => {
    updateReturning.mockResolvedValue([]);
    expect((await updateSubject("x", { id: SID, subject: "a" })).ok).toBe(false);
  });
});

describe("queries and actions", () => {
  it("lists recent subjects as strings", async () => {
    selectLimit.mockResolvedValue([{ subject: "Math" }, { subject: "Bio" }]);
    expect(await getMyRecentSubjects("u1")).toEqual(["Math", "Bio"]);
  });

  it("actions use the signed-in user, not input", async () => {
    insertReturning.mockResolvedValue([{ id: SID, subject: null, startedAt }]);
    expect((await startAction({})).ok).toBe(true);
    updateReturning.mockResolvedValue([{ minutes: 5, photoKey: null, rawMinutes: 5 }]);
    expect((await stopAction({ id: SID })).ok).toBe(true);
    expect(requireUser).toHaveBeenCalledTimes(2);
  });
});
