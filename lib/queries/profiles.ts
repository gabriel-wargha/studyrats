import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export type MyProfile = { displayName: string };

/** The caller's own saved profile, or null if no row exists yet. Keyed by userId. */
export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const [row] = await getDb()
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row ? { displayName: row.displayName } : null;
}
