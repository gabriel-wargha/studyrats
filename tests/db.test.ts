import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("lazy env and db", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("importing does not throw without env", async () => {
    await expect(import("@/lib/env")).resolves.toBeDefined();
    await expect(import("@/lib/db")).resolves.toBeDefined();
  });

  it("requireEnv throws MissingEnvError naming the variable", async () => {
    const { requireEnv, MissingEnvError } = await import("@/lib/env");
    expect(() => requireEnv("DATABASE_URL")).toThrow(MissingEnvError);
    expect(() => requireEnv("DATABASE_URL")).toThrow(/DATABASE_URL/);
  });

  it("requireEnv returns the value when set", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    const { requireEnv } = await import("@/lib/env");
    expect(requireEnv("DATABASE_URL")).toBe("postgres://x");
  });

  it("getDb() throws MissingEnvError without DATABASE_URL", async () => {
    const { getDb } = await import("@/lib/db");
    const { MissingEnvError } = await import("@/lib/env");
    expect(() => getDb()).toThrow(MissingEnvError);
  });
});
