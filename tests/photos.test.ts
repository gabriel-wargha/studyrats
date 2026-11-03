import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";
const OTHER_SID = "9a1b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b02";
const UUID = "0b6f1c2e-1111-4222-8333-444455556666";
const OWN_KEY = `u/u1/s/${SID}/${UUID}.jpg`;
const OLD_KEY = `u/u1/s/${SID}/aaaaaaaa-1111-4222-8333-444455556666.jpg`;

const selectLimit = vi.fn<() => Promise<unknown[]>>();
const updateReturning = vi.fn<() => Promise<unknown[]>>();
const updateSet = vi.fn();
const selectChain: Record<string, unknown> = {};
for (const m of ["select", "from", "where"]) selectChain[m] = vi.fn(() => selectChain);
selectChain.limit = selectLimit;
const db = {
  ...selectChain,
  update: vi.fn(() => ({
    set: (v: unknown) => {
      updateSet(v);
      return { where: () => ({ returning: updateReturning }) };
    },
  })),
};
vi.mock("@/lib/db", () => ({ getDb: () => db }));

const presignPut = vi.fn();
const headObject = vi.fn();
const deleteObject = vi.fn();
vi.mock("@/lib/storage", () => ({
  presignPut: (...a: unknown[]) => presignPut(...a),
  headObject: (...a: unknown[]) => headObject(...a),
  deleteObject: (...a: unknown[]) => deleteObject(...a),
}));
const requireUser = vi.fn();
vi.mock("@/lib/auth/server", () => ({ requireUser: (p?: string) => requireUser(p) }));

import { attachPhoto as attachAction, createPhotoUpload as createAction } from "@/app/actions/photos";
import { buildPhotoKey, isValidPhotoKey } from "@/lib/photo-key";
import { attachPhoto, createPhotoUpload } from "@/server/photos";
import { stopSession } from "@/server/sessions";

beforeEach(() => {
  for (const f of [selectLimit, updateReturning, updateSet, presignPut, headObject, deleteObject]) {
    f.mockReset();
  }
  db.update.mockClear();
  deleteObject.mockResolvedValue(undefined);
  requireUser.mockReset();
  requireUser.mockResolvedValue({ id: "u1", email: "a@b.c", name: "Ann" });
});

describe("photo keys", () => {
  it("builds a key under the user and session prefix", () => {
    const key = buildPhotoKey("u1", SID);
    expect(key.startsWith(`u/u1/s/${SID}/`)).toBe(true);
    expect(isValidPhotoKey("u1", SID, key)).toBe(true);
  });

  it("rejects other users, other sessions and path tricks", () => {
    expect(isValidPhotoKey("u1", SID, `u/u2/s/${SID}/${UUID}.jpg`)).toBe(false);
    expect(isValidPhotoKey("u1", SID, `u/u1/s/${OTHER_SID}/${UUID}.jpg`)).toBe(false);
    expect(isValidPhotoKey("u1", SID, `u/u1/s/${SID}/../x/${UUID}.jpg`)).toBe(false);
    expect(isValidPhotoKey("u1", SID, `u/u1/s/${SID}/other.jpg`)).toBe(false);
  });
});

describe("createPhotoUpload", () => {
  it("returns a key and presigned URL for an owned session", async () => {
    selectLimit.mockResolvedValue([{ photoKey: null }]);
    presignPut.mockResolvedValue("https://s3.example/put");
    const res = await createPhotoUpload("u1", { sessionId: SID });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.url).toBe("https://s3.example/put");
      expect(res.data.key.startsWith(`u/u1/s/${SID}/`)).toBe(true);
    }
    expect(presignPut).toHaveBeenCalledWith(expect.any(String), "image/jpeg");
  });

  it("refuses someone else's session", async () => {
    selectLimit.mockResolvedValue([]);
    const res = await createPhotoUpload("intruder", { sessionId: SID });
    expect(res.ok).toBe(false);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("rejects a bad id", async () => {
    expect((await createPhotoUpload("u1", { sessionId: "nope" })).ok).toBe(false);
    expect(presignPut).not.toHaveBeenCalled();
  });

  it("the action uses the logged-in user", async () => {
    selectLimit.mockResolvedValue([{ photoKey: null }]);
    presignPut.mockResolvedValue("https://s3.example/put");
    const res = await createAction({ sessionId: SID });
    expect(res.ok).toBe(true);
    expect(requireUser).toHaveBeenCalled();
  });
});

describe("attachPhoto", () => {
  it("saves the key and deletes the replaced photo", async () => {
    selectLimit.mockResolvedValue([{ photoKey: OLD_KEY }]);
    headObject.mockResolvedValue({ size: 400_000, contentType: "image/jpeg" });
    updateReturning.mockResolvedValue([{ id: SID }]);
    const res = await attachPhoto("u1", { sessionId: SID, key: OWN_KEY });
    expect(res).toEqual({ ok: true, data: { key: OWN_KEY } });
    expect(updateSet).toHaveBeenCalledWith({ photoKey: OWN_KEY });
    expect(deleteObject).toHaveBeenCalledWith(OLD_KEY);
  });

  it("does not delete anything when there was no old photo", async () => {
    selectLimit.mockResolvedValue([{ photoKey: null }]);
    headObject.mockResolvedValue({ size: 1000, contentType: "image/jpeg" });
    updateReturning.mockResolvedValue([{ id: SID }]);
    expect((await attachPhoto("u1", { sessionId: SID, key: OWN_KEY })).ok).toBe(true);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("rejects a key under another user's prefix without touching storage", async () => {
    selectLimit.mockResolvedValue([{ photoKey: null }]);
    const res = await attachPhoto("u1", { sessionId: SID, key: `u/u2/s/${SID}/${UUID}.jpg` });
    expect(res.ok).toBe(false);
    expect(headObject).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("refuses someone else's session", async () => {
    selectLimit.mockResolvedValue([]);
    const res = await attachPhoto("intruder", { sessionId: SID, key: OWN_KEY });
    expect(res.ok).toBe(false);
    expect(headObject).not.toHaveBeenCalled();
  });

  it("deletes an oversized object and does not save it", async () => {
    selectLimit.mockResolvedValue([{ photoKey: OLD_KEY }]);
    headObject.mockResolvedValue({ size: 5 * 1024 * 1024 + 1, contentType: "image/jpeg" });
    const res = await attachPhoto("u1", { sessionId: SID, key: OWN_KEY });
    expect(res.ok).toBe(false);
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledWith(OWN_KEY);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("accepts exactly 5 MB", async () => {
    selectLimit.mockResolvedValue([{ photoKey: null }]);
    headObject.mockResolvedValue({ size: 5 * 1024 * 1024, contentType: "image/jpeg" });
    updateReturning.mockResolvedValue([{ id: SID }]);
    expect((await attachPhoto("u1", { sessionId: SID, key: OWN_KEY })).ok).toBe(true);
  });

  it("fails when the object was never uploaded", async () => {
    selectLimit.mockResolvedValue([{ photoKey: null }]);
    headObject.mockResolvedValue(null);
    expect((await attachPhoto("u1", { sessionId: SID, key: OWN_KEY })).ok).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("still succeeds if deleting the old photo fails", async () => {
    selectLimit.mockResolvedValue([{ photoKey: OLD_KEY }]);
    headObject.mockResolvedValue({ size: 10, contentType: "image/jpeg" });
    updateReturning.mockResolvedValue([{ id: SID }]);
    deleteObject.mockRejectedValue(new Error("s3 down"));
    expect((await attachPhoto("u1", { sessionId: SID, key: OWN_KEY })).ok).toBe(true);
  });

  it("validates input and the action uses the logged-in user", async () => {
    expect((await attachPhoto("u1", { sessionId: "x", key: "" })).ok).toBe(false);
    selectLimit.mockResolvedValue([]);
    await attachAction({ sessionId: SID, key: OWN_KEY });
    expect(requireUser).toHaveBeenCalled();
  });
});

describe("stopSession photo cleanup", () => {
  it("deletes the object of a too-short session", async () => {
    updateReturning.mockResolvedValue([{ minutes: 0, photoKey: OWN_KEY, rawMinutes: 0 }]);
    (db as Record<string, unknown>).delete = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    const res = await stopSession("u1", { id: SID });
    expect(res).toEqual({ ok: true, data: { minutes: 0, capped: false } });
    expect(deleteObject).toHaveBeenCalledWith(OWN_KEY);
  });

  it("does not fail the stop when the delete throws", async () => {
    updateReturning.mockResolvedValue([{ minutes: 0, photoKey: OWN_KEY, rawMinutes: 0 }]);
    (db as Record<string, unknown>).delete = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    deleteObject.mockRejectedValue(new Error("s3 down"));
    const res = await stopSession("u1", { id: SID });
    expect(res).toEqual({ ok: true, data: { minutes: 0, capped: false } });
  });
});
