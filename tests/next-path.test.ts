import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_AUTH, resolveNextPath, withNext } from "@/lib/auth/next-path";

describe("resolveNextPath", () => {
  it("keeps same-origin relative paths, including query and hash", () => {
    expect(resolveNextPath("/study")).toBe("/study");
    expect(resolveNextPath("/join/ABCD1234?x=1#y")).toBe("/join/ABCD1234?x=1#y");
  });

  it("falls back for missing or empty values", () => {
    expect(resolveNextPath(null)).toBe(DEFAULT_AFTER_AUTH);
    expect(resolveNextPath(undefined)).toBe(DEFAULT_AFTER_AUTH);
    expect(resolveNextPath("")).toBe(DEFAULT_AFTER_AUTH);
  });

  it.each([
    "https://evil.com",
    "http://evil.com/groups",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "groups",
    "/\t/evil.com",
    "/\nfoo",
    "/sign-in",
    "/sign-up?next=/me",
  ])("rejects %j", (value) => {
    expect(resolveNextPath(value)).toBe(DEFAULT_AFTER_AUTH);
  });

  it("uses a custom fallback", () => {
    expect(resolveNextPath("//x.com", "/")).toBe("/");
  });
});

describe("withNext", () => {
  it("carries a safe next across pages", () => {
    expect(withNext("/sign-up", "/join/ABC?x=1")).toBe("/sign-up?next=%2Fjoin%2FABC%3Fx%3D1");
  });
  it("drops an unsafe or missing next", () => {
    expect(withNext("/sign-up", "//evil.com")).toBe("/sign-up");
    expect(withNext("/sign-up", null)).toBe("/sign-up");
  });
});
