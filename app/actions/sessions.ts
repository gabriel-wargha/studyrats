"use server";

import { requireUser } from "@/lib/auth/server";
import { ensureProfile } from "@/server/profiles";
import * as sessionsServer from "@/server/sessions";

export async function startSession(input: unknown) {
  const user = await requireUser("/study");
  await ensureProfile(user);
  return sessionsServer.startSession(user.id, input);
}

export async function stopSession(input: unknown) {
  const user = await requireUser("/study");
  return sessionsServer.stopSession(user.id, input);
}

export async function updateSubject(input: unknown) {
  const user = await requireUser("/study");
  return sessionsServer.updateSubject(user.id, input);
}
