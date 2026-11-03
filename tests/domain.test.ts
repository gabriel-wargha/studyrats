import { describe, expect, it } from "vitest";
import { currentWeekRange } from "@/lib/week";
import { computeMinutes, pointsForMinutes } from "@/lib/points";
import {
  generateInviteCode,
  INVITE_ALPHABET,
  normalizeInviteCode,
} from "@/lib/invite-code";
import { assignRanks } from "@/lib/ranking";

const iso = (r: { start: Date; end: Date }) => [r.start.toISOString(), r.end.toISOString()];

describe("currentWeekRange (America/Boise)", () => {
  it("Sunday 23:59 is still the old week, Monday 00:00 starts the new one", () => {
    // Jan 2027 is MST (UTC-7). Sun Jan 10 23:59 local = Jan 11 06:59Z.
    expect(iso(currentWeekRange(new Date("2027-01-11T06:59:00Z")))).toEqual([
      "2027-01-04T07:00:00.000Z",
      "2027-01-11T07:00:00.000Z",
    ]);
    expect(iso(currentWeekRange(new Date("2027-01-11T07:00:00Z")))).toEqual([
      "2027-01-11T07:00:00.000Z",
      "2027-01-18T07:00:00.000Z",
    ]);
  });

  it("spring forward week, Mar 2027 (starts MST, ends MDT, 167 hours)", () => {
    const r = currentWeekRange(new Date("2027-03-14T12:00:00Z"));
    expect(iso(r)).toEqual(["2027-03-08T07:00:00.000Z", "2027-03-15T06:00:00.000Z"]);
    expect((r.end.getTime() - r.start.getTime()) / 3_600_000).toBe(167);
  });

  it("fall back week, Nov 2026 (starts MDT, ends MST, 169 hours)", () => {
    const r = currentWeekRange(new Date("2026-11-01T12:00:00Z"));
    expect(iso(r)).toEqual(["2026-10-26T06:00:00.000Z", "2026-11-02T07:00:00.000Z"]);
    expect((r.end.getTime() - r.start.getTime()) / 3_600_000).toBe(169);
  });

  it("the Monday after a DST change starts at local midnight", () => {
    expect(currentWeekRange(new Date("2027-03-15T06:00:00Z")).start.toISOString()).toBe(
      "2027-03-15T06:00:00.000Z",
    );
    expect(currentWeekRange(new Date("2026-11-02T07:00:00Z")).start.toISOString()).toBe(
      "2026-11-02T07:00:00.000Z",
    );
  });
});

describe("points", () => {
  const t0 = new Date("2026-11-03T10:00:00Z");
  const after = (s: number) => new Date(t0.getTime() + s * 1000);

  it("gives 1 point per minute", () => expect(pointsForMinutes(42)).toBe(42));
  it("treats under 1 minute as too short", () => {
    expect(computeMinutes(t0, after(59)).kind).toBe("too_short");
    expect(computeMinutes(t0, after(0)).kind).toBe("too_short");
    expect(computeMinutes(t0, after(-30)).kind).toBe("too_short");
  });
  it("floors to whole minutes", () => {
    expect(computeMinutes(t0, after(60))).toEqual({ kind: "counted", minutes: 1, capped: false });
    expect(computeMinutes(t0, after(119))).toEqual({ kind: "counted", minutes: 1, capped: false });
  });
  it("does not cap 360 but caps 361", () => {
    expect(computeMinutes(t0, after(360 * 60))).toEqual({ kind: "counted", minutes: 360, capped: false });
    expect(computeMinutes(t0, after(361 * 60))).toEqual({ kind: "counted", minutes: 360, capped: true });
    expect(computeMinutes(t0, after(100 * 3600))).toEqual({ kind: "counted", minutes: 360, capped: true });
  });
});

describe("invite codes", () => {
  it("generates 8 chars from the alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateInviteCode();
      expect(c).toHaveLength(8);
      expect([...c].every((ch) => INVITE_ALPHABET.includes(ch))).toBe(true);
    }
    expect(INVITE_ALPHABET).not.toMatch(/[ILOU]/);
  });
  it("normalizes user input", () => {
    expect(normalizeInviteCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(normalizeInviteCode("oOiL1234")).toBe("00111234");
  });
  it("rejects bad input", () => {
    expect(normalizeInviteCode("")).toBeNull();
    expect(normalizeInviteCode("ABC")).toBeNull();
    expect(normalizeInviteCode("ABCD234U")).toBeNull();
    expect(normalizeInviteCode("ABCD23456")).toBeNull();
    expect(normalizeInviteCode("ABCD234!")).toBeNull();
  });
});

describe("assignRanks", () => {
  it("sorts descending and ties share a rank", () => {
    const out = assignRanks([
      { id: "a", points: 5 },
      { id: "b", points: 10 },
      { id: "c", points: 10 },
      { id: "d", points: 0 },
    ]);
    expect(out.map((r) => [r.id, r.rank])).toEqual([
      ["b", 1],
      ["c", 1],
      ["a", 3],
      ["d", 4],
    ]);
  });
  it("handles empty and all-zero", () => {
    expect(assignRanks([])).toEqual([]);
    expect(assignRanks([{ points: 0 }, { points: 0 }]).map((r) => r.rank)).toEqual([1, 1]);
  });
  it("does not mutate input", () => {
    const input = [{ points: 1 }, { points: 2 }];
    assignRanks(input);
    expect(input[0].points).toBe(1);
  });
});
