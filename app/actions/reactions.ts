"use server";

import { requireUser } from "@/lib/auth/server";
import { requireMember } from "@/lib/authz";
import { loadFeedPageSchema } from "@/lib/schemas/reactions";
import { ensureProfile } from "@/server/profiles";
import * as reactionsServer from "@/server/reactions";

export async function toggleReaction(input: unknown) {
  const user = await requireUser("/");
  await ensureProfile(user);
  return reactionsServer.toggleReaction(user.id, input);
}

/** "Load more" for the feed screen. Membership is checked before any data is read. */
export async function loadMoreFeed(input: unknown) {
  const parsed = loadFeedPageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Could not load more, please refresh the feed" };
  }
  const ctx = await requireMember(parsed.data.groupId);
  return reactionsServer.loadFeedPage(ctx, parsed.data.cursor);
}
