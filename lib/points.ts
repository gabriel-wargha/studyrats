export const MAX_SESSION_MINUTES = 360;
export const MIN_SESSION_MINUTES = 1;

export function pointsForMinutes(minutes: number): number {
  return minutes;
}

export type ComputedMinutes =
  | { kind: "too_short"; minutes: 0; capped: false }
  | { kind: "counted"; minutes: number; capped: boolean };

/** Mirrors the SQL on stop: floor to whole minutes, drop under 1, cap at 360. */
export function computeMinutes(startedAt: Date, endedAt: Date): ComputedMinutes {
  const ms = endedAt.getTime() - startedAt.getTime();
  const whole = Number.isFinite(ms) ? Math.floor(ms / 60_000) : 0;
  if (whole < MIN_SESSION_MINUTES) return { kind: "too_short", minutes: 0, capped: false };
  if (whole > MAX_SESSION_MINUTES) {
    return { kind: "counted", minutes: MAX_SESSION_MINUTES, capped: true };
  }
  return { kind: "counted", minutes: whole, capped: false };
}
