import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "lib/queries");

/**
 * Exported functions allowed to skip the GroupCtx / userId first parameter.
 * Keep this list short and justified.
 */
const ALLOWED: Record<string, string> = {
  "feed.ts:encodeCursor": "pure helper, no database access",
  "feed.ts:decodeCursor": "pure helper, no database access",
  "groups.ts:getGroupByInviteCode":
    "pre-membership join preview; needs the secret invite code, returns only name, type and member count",
};

type Fn = { file: string; name: string; firstParam: string | null; firstType: string | null };

const FN_RE = /export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(\s*([^)]*)/g;
const ARROW_RE = /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(\s*([^)]*)\)\s*(?::[^=]+)?=>/g;

function exportedFunctions(): Fn[] {
  const out: Fn[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(dir, file), "utf8");
    for (const re of [FN_RE, ARROW_RE]) {
      for (const m of src.matchAll(re)) {
        const first = m[2].split(",")[0].trim();
        const [name, type] = first.split(":").map((s) => s.trim());
        out.push({
          file,
          name: m[1],
          firstParam: name.split(/[=?]/)[0].trim() || null,
          firstType: type ? type.split("=")[0].trim() : null,
        });
      }
    }
  }
  return out;
}

describe("lib/queries authorization guard", () => {
  const fns = exportedFunctions();

  it("finds the query functions", () => {
    expect(fns.length).toBeGreaterThanOrEqual(8);
  });

  it("every exported function takes ctx: GroupCtx or userId first", () => {
    const bad = fns
      .filter((f) => !(`${f.file}:${f.name}` in ALLOWED))
      .filter((f) => f.firstParam !== "ctx" && f.firstParam !== "userId")
      .map((f) => `${f.file}:${f.name}(${f.firstParam ?? ""})`);
    expect(bad).toEqual([]);
  });

  it("ctx parameters are typed GroupCtx and userId parameters are strings", () => {
    for (const f of fns) {
      if (f.firstParam === "ctx") expect(f.firstType, `${f.file}:${f.name}`).toBe("GroupCtx");
      if (f.firstParam === "userId") expect(f.firstType, `${f.file}:${f.name}`).toBe("string");
    }
  });

  it("the allow-list has no stale entries", () => {
    const names = new Set(fns.map((f) => `${f.file}:${f.name}`));
    for (const key of Object.keys(ALLOWED)) expect(names.has(key), key).toBe(true);
  });
});
