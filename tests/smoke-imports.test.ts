import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The third-party auth package imports "next/headers" without an extension, which
// plain Node ESM cannot resolve under Vitest. Stub the package; our own modules
// are still imported for real.
vi.mock("@neon/auth/next/server", () => ({ createNeonAuth: vi.fn(() => ({})) }));

const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const files = [...walk(join(root, "lib")), ...walk(join(root, "app/actions"))]
  .map((f) => relative(root, f))
  .sort();

const ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "NEON_AUTH_BASE_URL",
  "NEON_AUTH_COOKIE_SECRET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
];

describe("import with no environment variables", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("finds files to check", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain("app/actions/sessions.ts");
    expect(files).toContain("lib/queries/feed.ts");
  });

  it.each(files)("%s imports without throwing", async (file) => {
    await expect(import(/* @vite-ignore */ join(root, file))).resolves.toBeDefined();
  });
});
