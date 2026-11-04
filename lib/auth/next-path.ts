/**
 * Client-safe check for the ?next= redirect target. Only same-origin relative
 * paths are allowed; anything else falls back to `fallback`.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback = "/groups",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  // Backslashes and control characters are normalised by browsers into slashes.
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://studyrats.invalid");
    if (url.origin !== "http://studyrats.invalid") return fallback;
  } catch {
    return fallback;
  }
  return next;
}
