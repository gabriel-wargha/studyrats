"use server";

import { requireUser } from "@/lib/auth/server";
import * as groupsServer from "@/server/groups";
import { ensureProfile } from "@/server/profiles";

export async function createGroup(input: unknown) {
  const user = await requireUser("/groups/new");
  await ensureProfile(user);
  return groupsServer.createGroup(user.id, input);
}

export async function joinGroup(input: unknown) {
  const user = await requireUser("/join");
  await ensureProfile(user);
  return groupsServer.joinGroup(user.id, input);
}
