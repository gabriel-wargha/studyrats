"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { ensureProfile } from "@/server/profiles";
import {
  startSession as startSessionImpl,
  stopSession as stopSessionImpl,
  updateSubject as updateSubjectImpl,
} from "@/server/sessions";

/** Input: { subject?: string }. Returns the running session (existing one if already running). */
export async function startSession(input: unknown) {
  const user = await requireUser("/study");
  await ensureProfile(user); // sessions reference profiles
  const result = await startSessionImpl(user.id, input);
  if (result.ok) revalidatePath("/study");
  return result;
}

/** Returns { minutes, capped, discarded, orphanedPhotoKey }. Under 1 minute is discarded. */
export async function stopSession(id: unknown) {
  const user = await requireUser("/study");
  const result = await stopSessionImpl(user.id, id);
  if (result.ok) {
    revalidatePath("/study");
    revalidatePath("/groups");
  }
  return result;
}

/** Input: session id, subject (empty clears it). */
export async function updateSubject(id: unknown, subject: unknown) {
  const user = await requireUser("/study");
  const result = await updateSubjectImpl(user.id, id, subject);
  if (result.ok) revalidatePath("/study");
  return result;
}
