import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/server";
import { updateDisplayNameSchema } from "@/lib/schemas/profiles";
import type { ActionResult } from "@/server/groups";

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

/** Changes the caller's own display name. Only their own row is touched. */
export async function updateDisplayName(
  userId: string,
  input: unknown,
): Promise<ActionResult<{ displayName: string }>> {
  const parsed = updateDisplayNameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the name and try again",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const updated = await getDb()
    .update(profiles)
    .set({ displayName: parsed.data.displayName })
    .where(eq(profiles.userId, userId))
    .returning({ displayName: profiles.displayName });
  if (updated.length === 0) return { ok: false, error: "Profile not found" };
  return { ok: true, data: { displayName: parsed.data.displayName } };
}
