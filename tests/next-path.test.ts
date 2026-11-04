import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/next-path";

describe("safeRedirectPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeRedirectPath("/join/ABC123?x=1#y")).toBe("/join/ABC123?x=1#y");
    expect(safeRedirectPath("/study")).toBe("/study");
  });

  it("falls back for missing, absolute and protocol-relative targets", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "groups",
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "/\t/evil.com",
    ]) {
      expect(safeRedirectPath(bad)).toBe("/groups");
    }
  });

  it("uses a custom fallback", () => {
    expect(safeRedirectPath("//x", "/")).toBe("/");
  });
});
