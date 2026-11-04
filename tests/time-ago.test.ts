import { describe, expect, it } from "vitest";
import { timeAgo } from "@/lib/time-ago";

const now = Date.UTC(2026, 10, 4, 12, 0, 0);

describe("timeAgo", () => {
  it("handles recent times", () => {
    expect(timeAgo(now - 5_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(timeAgo(now - 86_400_000, now)).toBe("1 day ago");
  });
  it("never goes negative for future clocks", () => {
    expect(timeAgo(now + 60_000, now)).toBe("just now");
  });
  it("falls back to a date after a week", () => {
    expect(timeAgo(now - 10 * 86_400_000, now)).toBe("Oct 25");
  });
});
