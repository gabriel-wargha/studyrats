"use server";

import { requireUser } from "@/lib/auth/server";
import { getMyStats as getMyStatsQuery } from "@/lib/queries/stats";
import * as profilesServer from "@/server/profiles";

export async function updateDisplayName(input: unknown) {
  const user = await requireUser("/me");
  await profilesServer.ensureProfile(user);
  return profilesServer.updateDisplayName(user.id, input);
}

export async function getMyStats() {
  const user = await requireUser("/me");
  return getMyStatsQuery(user.id);
}
