export const MAX_SESSION_MINUTES = 360;

/** One point per study minute. The only place this rule lives. */
export function pointsForMinutes(minutes: number): number {
  return minutes;
}

export type ComputedMinutes =
  | { discard: true; minutes: 0; capped: false }
  | { discard: false; minutes: number; capped: boolean };

/**
 * Whole minutes between start and end (rounded down). Under 1 minute means
 * the session is discarded. Anything over 360 is capped at 360.
 * Mirrors the SQL in stopSession.
 */
export function computeMinutes(start: Date, end: Date): ComputedMinutes {
  const raw = Math.floor((end.getTime() - start.getTime()) / 60_000);
  if (!Number.isFinite(raw) || raw < 1) {
    return { discard: true, minutes: 0, capped: false };
  }
  if (raw > MAX_SESSION_MINUTES) {
    return { discard: false, minutes: MAX_SESSION_MINUTES, capped: true };
  }
  return { discard: false, minutes: raw, capped: false };
}
