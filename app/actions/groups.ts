"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { createGroup as createGroupImpl, joinGroup as joinGroupImpl } from "@/server/groups";
import { ensureProfile } from "@/server/profiles";

/** Input: { name, type: "friends" | "class" }. Returns the new group id and invite code. */
export async function createGroup(input: unknown) {
  const user = await requireUser("/groups/new");
  await ensureProfile(user); // memberships reference profiles
  const result = await createGroupImpl(user.id, input);
  if (result.ok) revalidatePath("/groups");
  return result;
}

/** Input: the invite code as typed. Safe to call twice. */
export async function joinGroup(code: unknown) {
  const user = await requireUser("/join");
  await ensureProfile(user);
  const result = await joinGroupImpl(user.id, code);
  if (result.ok) revalidatePath("/groups");
  return result;
}
