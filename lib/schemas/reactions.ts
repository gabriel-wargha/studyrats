import { z } from "zod";

export const toggleReactionSchema = z.object({
  sessionId: z.uuid(),
  kind: z.enum(["fire", "clap", "brain", "muscle"]),
});

export const loadFeedPageSchema = z.object({
  groupId: z.string().min(1).max(64),
  cursor: z.string().min(1).max(300).optional(),
});
