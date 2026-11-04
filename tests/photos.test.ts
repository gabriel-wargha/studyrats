import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";
const OTHER_SID = "9a1b2c3d-5d4a-4b7e-9c10-2a6d8e4f7b02";
const FILE = "0d1e2f30-1111-4222-8333-444455556666.jpg";
const KEY = `u/u1/s/${SID}/${FILE}`;

const state = { selectRows: [] as unknown[], updateRows: [] as unknown[] };
const calls = { update: vi.fn() };
const selectChain = () => {
  const c: Record<string, unknown> = {};
  for (const m of ["from", "where"]) c[m] = () => c;
  c.limit = async () => state.selectRows;
  return c;
};
const db = {
  select: () => selectChain(),
  update: () => ({
    set: (v: unknown) => {
      calls.update(v);
      return { where: () => ({ returning: async () => state.updateRows }) };
    },
  }),
};
vi.mock("@/lib/db", () => ({ getDb: () => db }));

const storage = vi.hoisted(() => ({
  presignPut: vi.fn(),
  headObject: vi.fn(),
  deleteObjectQuietly: vi.fn(),
}));
vi.mock("@/lib/storage", () => storage);

import { attachPhoto, createPhotoUpload } from "@/server/photos";
import { buildPhotoKey, isValidPhotoKey } from "@/lib/photo-key";

beforeEach(() => {
  Object.assign(state, { selectRows: [], updateRows: [] });
  calls.update.mockClear();
  Object.values(storage).forEach((f) => f.mockReset());
  storage.presignPut.mockResolvedValue("https://s3.example/put");
  storage.deleteObjectQuietly.mockResolvedValue(undefined);
});

describe("photo keys", () => {
  it("builds keys that validate for the same user and session only", () => {
    const key = buildPhotoKey("u1", SID);
    expect(key).toMatch(new RegExp(`^u/u1/s/${SID}/[0-9a-f-]{36}\\.jpg$`));
    expect(isValidPhotoKey(key, "u1", SID)).toBe(true);
    expect(isValidPhotoKey(key, "u2", SID)).toBe(false);
    expect(isValidPhotoKey(key, "u1", OTHER_SID)).toBe(false);
  });

  it("rejects traversal, nesting and odd file names", () => {
    expect(isValidPhotoKey(`u/u1/s/${SID}/../x.jpg`, "u1", SID)).toBe(false);
    expect(isValidPhotoKey(`u/u1/s/${SID}/a/${FILE}`, "u1", SID)).toBe(false);
    expect(isValidPhotoKey(`u/u1/s/${SID}/evil.jpg`, "u1", SID)).toBe(false);
    expect(isValidPhotoKey(42, "u1", SID)).toBe(false);
  });
});

describe("createPhotoUpload", () => {
  it("rejects a bad id", async () => {
    expect((await createPhotoUpload("u1", "nope")).ok).toBe(false);
    expect(storage.presignPut).not.toHaveBeenCalled();
  });

  it("refuses someone else's session", async () => {
    expect(await createPhotoUpload("intruder", SID)).toEqual({ ok: false, error: "Session not found" });
    expect(storage.presignPut).not.toHaveBeenCalled();
  });

  it("returns a key under the user's session prefix and a presigned URL", async () => {
    state.selectRows = [{ id: SID }];
    const res = await createPhotoUpload("u1", SID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(isValidPhotoKey(res.data.key, "u1", SID)).toBe(true);
    expect(res.data.url).toBe("https://s3.example/put");
    expect(storage.presignPut).toHaveBeenCalledWith(res.data.key, "image/jpeg");
  });
});

describe("attachPhoto", () => {
  it("validates input", async () => {
    expect((await attachPhoto("u1", { sessionId: "x", key: KEY })).ok).toBe(false);
    expect((await attachPhoto("u1", { sessionId: SID })).ok).toBe(false);
  });

  it("rejects a key under another user's prefix without touching storage", async () => {
    const res = await attachPhoto("u1", { sessionId: SID, key: `u/u2/s/${SID}/${FILE}` });
    expect(res).toEqual({ ok: false, error: "Invalid photo key" });
    expect(storage.headObject).not.toHaveBeenCalled();
    expect(storage.deleteObjectQuietly).not.toHaveBeenCalled();
  });

  it("rejects a key from a different session", async () => {
    const res = await attachPhoto("u1", { sessionId: SID, key: `u/u1/s/${OTHER_SID}/${FILE}` });
    expect(res.ok).toBe(false);
  });

  it("refuses someone else's session", async () => {
    const res = await attachPhoto("u1", { sessionId: SID, key: KEY });
    expect(res).toEqual({ ok: false, error: "Session not found" });
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it("fails when nothing was uploaded", async () => {
    state.selectRows = [{ photoKey: null }];
    storage.headObject.mockResolvedValue(null);
    expect((await attachPhoto("u1", { sessionId: SID, key: KEY })).ok).toBe(false);
    expect(calls.update).not.toHaveBeenCalled();
  });

  it("deletes an oversized object and does not attach it", async () => {
    state.selectRows = [{ photoKey: null }];
    storage.headObject.mockResolvedValue({ size: 5 * 1024 * 1024 + 1, contentType: "image/jpeg" });
    const res = await attachPhoto("u1", { sessionId: SID, key: KEY });
    expect(res.ok).toBe(false);
    expect(storage.deleteObjectQuietly).toHaveBeenCalledWith(KEY);
    expect(calls.update).not.toHaveBeenCalled();
  });

  it("attaches a photo and replaces (deletes) the old one", async () => {
    const oldKey = `u/u1/s/${SID}/aaaaaaaa-1111-4222-8333-444455556666.jpg`;
    state.selectRows = [{ photoKey: oldKey }];
    state.updateRows = [{ id: SID }];
    storage.headObject.mockResolvedValue({ size: 400_000, contentType: "image/jpeg" });
    const res = await attachPhoto("u1", { sessionId: SID, key: KEY });
    expect(res).toEqual({ ok: true, data: { photoKey: KEY } });
    expect(calls.update).toHaveBeenCalledWith({ photoKey: KEY });
    expect(storage.deleteObjectQuietly).toHaveBeenCalledWith(oldKey);
  });

  it("does not delete anything when re-attaching the same key", async () => {
    state.selectRows = [{ photoKey: KEY }];
    state.updateRows = [{ id: SID }];
    storage.headObject.mockResolvedValue({ size: 10, contentType: "image/jpeg" });
    expect((await attachPhoto("u1", { sessionId: SID, key: KEY })).ok).toBe(true);
    expect(storage.deleteObjectQuietly).not.toHaveBeenCalled();
  });

  it("cleans up the new object if the session vanished before the update", async () => {
    state.selectRows = [{ photoKey: null }];
    state.updateRows = [];
    storage.headObject.mockResolvedValue({ size: 10, contentType: "image/jpeg" });
    expect((await attachPhoto("u1", { sessionId: SID, key: KEY })).ok).toBe(false);
    expect(storage.deleteObjectQuietly).toHaveBeenCalledWith(KEY);
  });
});
