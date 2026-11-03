/** Where signed-in users land when no (valid) ?next= is given. */
export const DEFAULT_AFTER_AUTH = "/groups";

const AUTH_PAGES = ["/sign-in", "/sign-up"];

/**
 * Returns a safe same-origin relative path for post-login redirects.
 * Anything else (absolute URLs, protocol-relative `//host`, backslashes,
 * control characters, auth pages themselves) falls back to the default.
 * Pure on purpose: it is used in client components and tests.
 */
export function resolveNextPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_AFTER_AUTH,
): string {
  if (typeof next !== "string" || next === "") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  // Backslashes and control chars are treated as "/" or stripped by browsers.
  if (next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    if (AUTH_PAGES.includes(url.pathname)) return fallback;
  } catch {
    return fallback;
  }
  return next;
}

/** Keeps ?next= when switching between the sign-in and sign-up pages. */
export function withNext(path: string, next: string | null | undefined): string {
  const safe = resolveNextPath(next, "");
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}
