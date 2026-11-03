import { MAX_SESSION_MINUTES } from "@/lib/points";

/** Whole seconds between the server's start time and "now" (never negative). */
export function elapsedSeconds(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

/** 0:07, 12:34 or 1:02:03. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function isPastCap(totalSeconds: number): boolean {
  return totalSeconds >= MAX_SESSION_MINUTES * 60;
}
