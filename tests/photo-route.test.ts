import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "3f2b8c1e-5d4a-4b7e-9c10-2a6d8e4f7b01";

const canSeeSession = vi.fn<(viewerId: string, sessionId: string) => Promise<boolean>>();
vi.mock("@/lib/authz", () => ({
  canSeeSession: (viewerId: string, sessionId: string) => canSeeSession(viewerId, sessionId),
}));
const selectLimit = vi.fn<() => Promise<unknown[]>>();
const chain: Record<string, unknown> = {};
for (const m of ["select", "from", "where"]) chain[m] = vi.fn(() => chain);
chain.limit = selectLimit;
vi.mock("@/lib/db", () => ({ getDb: () => chain }));
const presignGet = vi.fn();
vi.mock("@/lib/storage", () => ({
  presignGet: (...a: unknown[]) => presignGet(...a),
  presignPut: vi.fn(),
  headObject: vi.fn(),
  deleteObject: vi.fn(),
}));
const requireUser = vi.fn();
vi.mock("@/lib/auth/server", () => ({ requireUser: (p?: string) => requireUser(p) }));

import { GET } from "@/app/api/photos/[sessionId]/route";

const call = (id = SID) =>
  GET(new Request("http://x/api/photos/" + id), { params: Promise.resolve({ sessionId: id }) });

describe("GET /api/photos/[sessionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "u1" });
    presignGet.mockResolvedValue("https://s3.example/signed");
  });

  it("404s for a non-member without reading the session", async () => {
    canSeeSession.mockResolvedValue(false);
    const res = await call();
    expect(res.status).toBe(404);
    expect(canSeeSession).toHaveBeenCalledWith("u1", SID);
    expect(selectLimit).not.toHaveBeenCalled();
    expect(presignGet).not.toHaveBeenCalled();
  });

  it("404s when the session has no photo", async () => {
    canSeeSession.mockResolvedValue(true);
    selectLimit.mockResolvedValue([{ photoKey: null }]);
    const res = await call();
    expect(res.status).toBe(404);
    expect(presignGet).not.toHaveBeenCalled();
  });

  it("302s to the presigned URL with Cache-Control: private", async () => {
    canSeeSession.mockResolvedValue(true);
    selectLimit.mockResolvedValue([{ photoKey: "u/u2/s/x/y.jpg" }]);
    const res = await call();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://s3.example/signed");
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(presignGet).toHaveBeenCalledWith("u/u2/s/x/y.jpg");
  });
});
