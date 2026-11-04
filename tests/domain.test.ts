import { describe, expect, it } from "vitest";
import { currentWeekRange } from "@/lib/week";
import { computeMinutes, pointsForMinutes } from "@/lib/points";
import {
  generateInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/invite-code";
import { assignRanks } from "@/lib/ranking";

const iso = (r: { start: Date; end: Date }) => [
  r.start.toISOString(),
  r.end.toISOString(),
];
const hours = (r: { start: Date; end: Date }) =>
  (r.end.getTime() - r.start.getTime()) / 3_600_000;

describe("currentWeekRange (America/Boise)", () => {
  it("normal week (MST, UTC-7)", () => {
    const r = currentWeekRange(new Date("2026-12-02T12:00:00Z"));
    expect(iso(r)).toEqual([
      "2026-11-30T07:00:00.000Z",
      "2026-12-07T07:00:00.000Z",
    ]);
  });

  it("Sunday 23:59 is still the old week, Monday 00:00 starts a new one", () => {
    const sun = currentWeekRange(new Date("2026-12-07T06:59:00Z"));
    const mon = currentWeekRange(new Date("2026-12-07T07:00:00Z"));
    expect(sun.end.toISOString()).toBe("2026-12-07T07:00:00.000Z");
    expect(mon.start.toISOString()).toBe("2026-12-07T07:00:00.000Z");
  });

  it("November 2026 DST end (Nov 1) makes a 169 hour week", () => {
    const r = currentWeekRange(new Date("2026-11-01T12:00:00Z"));
    expect(iso(r)).toEqual([
      "2026-10-26T06:00:00.000Z",
      "2026-11-02T07:00:00.000Z",
    ]);
    expect(hours(r)).toBe(169);
  });

  it("March 2027 DST start (Mar 14) makes a 167 hour week", () => {
    const r = currentWeekRange(new Date("2027-03-14T12:00:00Z"));
    expect(iso(r)).toEqual([
      "2027-03-08T07:00:00.000Z",
      "2027-03-15T06:00:00.000Z",
    ]);
    expect(hours(r)).toBe(167);
  });

  it("the week after each changeover starts at the new offset", () => {
    const nov = currentWeekRange(new Date("2026-11-03T12:00:00Z"));
    expect(nov.start.toISOString()).toBe("2026-11-02T07:00:00.000Z");
    const mar = currentWeekRange(new Date("2027-03-16T12:00:00Z"));
    expect(mar.start.toISOString()).toBe("2027-03-15T06:00:00.000Z");
  });

  it("uses Boise time, not UTC, near the boundary", () => {
    const r = currentWeekRange(new Date("2026-12-07T03:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-11-30T07:00:00.000Z");
  });
});

describe("points", () => {
  const t0 = new Date("2026-11-04T10:00:00Z");
  const after = (ms: number) => new Date(t0.getTime() + ms);

  it("pointsForMinutes is 1 per minute", () => {
    expect(pointsForMinutes(0)).toBe(0);
    expect(pointsForMinutes(42)).toBe(42);
  });

  it("discards sessions under one minute", () => {
    expect(computeMinutes(t0, after(59_999))).toEqual({
      discard: true,
      minutes: 0,
      capped: false,
    });
    expect(computeMinutes(t0, after(-5000)).discard).toBe(true);
  });

  it("floors to whole minutes", () => {
    expect(computeMinutes(t0, after(60_000))).toEqual({
      discard: false,
      minutes: 1,
      capped: false,
    });
    expect(computeMinutes(t0, after(119_999)).minutes).toBe(1);
  });

  it("caps at 360 minutes", () => {
    expect(computeMinutes(t0, after(360 * 60_000))).toEqual({
      discard: false,
      minutes: 360,
      capped: false,
    });
    expect(computeMinutes(t0, after(361 * 60_000))).toEqual({
      discard: false,
      minutes: 360,
      capped: true,
    });
  });
});

describe("invite codes", () => {
  it("generates valid 8 char codes without I, L, O, U", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateInviteCode();
      expect(c).toHaveLength(8);
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
      expect(isValidInviteCode(c)).toBe(true);
    }
  });

  it("normalises user input", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeInviteCode("oiL0 1234")).toBe("01101234");
  });

  it("rejects bad codes", () => {
    expect(isValidInviteCode("ABC")).toBe(false);
    expect(isValidInviteCode("ABCDEFGU")).toBe(false);
    expect(isValidInviteCode("abcdefgh")).toBe(false);
  });
});

describe("assignRanks", () => {
  it("gives ties the same rank and skips the next", () => {
    const r = assignRanks([
      { name: "a", points: 10 },
      { name: "b", points: 10 },
      { name: "c", points: 8 },
      { name: "d", points: 0 },
      { name: "e", points: 0 },
    ]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3, 4, 4]);
  });

  it("handles empty input", () => {
    expect(assignRanks([])).toEqual([]);
  });
});
