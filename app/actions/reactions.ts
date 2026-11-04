"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { ensureProfile } from "@/server/profiles";
import { toggleReaction as toggleReactionImpl } from "@/server/reactions";

/**
 * Input: { sessionId, kind } where kind is fire | clap | brain | muscle.
 * Returns { sessionId, kind, active }; active is true when the reaction is now on.
 */
export async function toggleReaction(input: unknown) {
  const user = await requireUser("/groups");
  await ensureProfile(user); // reactions reference profiles
  const result = await toggleReactionImpl(user.id, input);
  if (result.ok) revalidatePath("/groups");
  return result;
}
