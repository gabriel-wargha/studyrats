import { describe, expect, it } from "vitest";

describe("test setup", () => {
  it("runs vitest with no env vars", () => {
    expect(1 + 1).toBe(2);
  });
});
