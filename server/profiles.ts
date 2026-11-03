import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/server";

/** Display names must be 1 to 40 characters (profiles_display_name_len). */
export function displayNameFor(user: Pick<SessionUser, "email" | "name">): string {
  const raw = user.name.trim() || user.email.split("@")[0]?.trim() || "Student";
  return Array.from(raw).slice(0, 40).join("");
}

/** Creates the profile on first sign-in. Never overwrites an existing name. */
export async function ensureProfile(user: SessionUser): Promise<void> {
  await getDb()
    .insert(profiles)
    .values({ userId: user.id, displayName: displayNameFor(user) })
    .onConflictDoNothing({ target: profiles.userId });
}
