import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const createNeonAuth = vi.fn<(config?: unknown) => never>(() => ({ getSession }) as never);
vi.mock("@neon/auth/next/server", () => ({ createNeonAuth }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

beforeEach(() => {
  vi.resetModules();
  getSession.mockReset();
  createNeonAuth.mockClear();
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.com/db");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "x".repeat(32));
});

describe("lib/auth/server", () => {
  it("does nothing at import time", async () => {
    vi.unstubAllEnvs();
    await import("@/lib/auth/server");
    expect(createNeonAuth).not.toHaveBeenCalled();
  });

  it("getSessionUser returns the user or null", async () => {
    createNeonAuth.mockReturnValue({ getSession } as never);
    const { getSessionUser } = await import("@/lib/auth/server");
    getSession.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "a@b.c", name: "Ann", extra: 1 } },
    });
    expect(await getSessionUser()).toEqual({ id: "u1", email: "a@b.c", name: "Ann" });
    getSession.mockResolvedValueOnce({ data: null });
    expect(await getSessionUser()).toBeNull();
  });

  it("requireUser redirects logged-out users with next", async () => {
    createNeonAuth.mockReturnValue({ getSession } as never);
    const { requireUser } = await import("@/lib/auth/server");
    getSession.mockResolvedValue({ data: null });
    await expect(requireUser("/groups/abc?x=1")).rejects.toThrow(
      "REDIRECT:/sign-in?next=%2Fgroups%2Fabc%3Fx%3D1",
    );
  });

  it("requireUser rejects open-redirect targets", async () => {
    createNeonAuth.mockReturnValue({ getSession } as never);
    const { requireUser } = await import("@/lib/auth/server");
    getSession.mockResolvedValue({ data: null });
    await expect(requireUser("//evil.com")).rejects.toThrow("REDIRECT:/sign-in?next=%2F");
  });

  it("requireUser returns the user when logged in", async () => {
    createNeonAuth.mockReturnValue({ getSession } as never);
    const { requireUser } = await import("@/lib/auth/server");
    getSession.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.c", name: null } } });
    expect(await requireUser()).toEqual({ id: "u1", email: "a@b.c", name: "" });
  });

  it("throws MissingEnvError lazily when env is unset", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "");
    const { getSessionUser } = await import("@/lib/auth/server");
    await expect(getSessionUser()).rejects.toThrow("NEON_AUTH_BASE_URL");
  });
});

describe("auth route and proxy", () => {
  it("route builds the handler lazily and forwards", async () => {
    const GET = vi.fn(async () => new Response("ok"));
    createNeonAuth.mockReturnValue({ handler: () => ({ GET }) } as never);
    const route = await import("@/app/api/auth/[...path]/route");
    expect(createNeonAuth).not.toHaveBeenCalled();
    const res = await route.GET(new Request("http://x/api/auth/get-session"), {
      params: Promise.resolve({ path: ["get-session"] }),
    });
    expect(await res.text()).toBe("ok");
  });

  it("proxy adds next to the sign-in redirect and has the right matcher", async () => {
    const mw = vi.fn(
      async () =>
        new Response(null, { status: 307, headers: { location: "http://x/sign-in?a=1" } }),
    );
    createNeonAuth.mockReturnValue({ middleware: () => mw } as never);
    const { default: proxy, config } = await import("@/proxy");
    expect(config.matcher).toEqual(["/groups/:path*", "/study", "/me", "/join/:path*"]);
    const res = await proxy({
      url: "http://x/study?t=1",
      nextUrl: new URL("http://x/study?t=1"),
    } as never);
    expect(res.headers.get("location")).toBe("http://x/sign-in?next=%2Fstudy%3Ft%3D1");
  });
});
