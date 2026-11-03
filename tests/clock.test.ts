import { describe, expect, it } from "vitest";
import { elapsedSeconds, formatClock, isPastCap } from "@/lib/clock";

describe("clock helpers", () => {
  it("formats under and over an hour", () => {
    expect(formatClock(7)).toBe("0:07");
    expect(formatClock(754)).toBe("12:34");
    expect(formatClock(3723)).toBe("1:02:03");
  });

  it("never returns negative elapsed time", () => {
    expect(elapsedSeconds(10_000, 5_000)).toBe(0);
    expect(elapsedSeconds(0, 61_999)).toBe(61);
  });

  it("flags the 6 hour cap", () => {
    expect(isPastCap(6 * 3600 - 1)).toBe(false);
    expect(isPastCap(6 * 3600)).toBe(true);
  });
});
