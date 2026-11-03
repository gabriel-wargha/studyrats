import { createNeonAuth } from "@neon/auth/next/server";
import { redirect } from "next/navigation";
import { requireEnv } from "@/lib/env";

export type SessionUser = { id: string; email: string; name: string };

type NeonAuth = ReturnType<typeof createNeonAuth>;

let auth: NeonAuth | undefined;

/** Builds the SDK on first call. Throws MissingEnvError if env vars are unset. */
export function getAuth(): NeonAuth {
  auth ??= createNeonAuth({
    baseUrl: requireEnv("NEON_AUTH_BASE_URL"),
    cookies: { secret: requireEnv("NEON_AUTH_COOKIE_SECRET") },
  });
  return auth;
}

/** The signed-in user, or null when logged out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { data: session } = await getAuth().getSession();
  const user = session?.user;
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name ?? "" };
}

/** Only same-site paths are allowed as a post-login target. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/";
  }
  return next;
}

/** Returns the signed-in user, or redirects to /sign-in?next=<returnPath>. */
export async function requireUser(returnPath = "/"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(safeNextPath(returnPath))}`);
  }
  return user;
}
