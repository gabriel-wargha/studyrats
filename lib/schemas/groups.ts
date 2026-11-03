import { z } from "zod";
import { normalizeInviteCode } from "@/lib/invite-code";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(40, "Name is at most 40 characters"),
  type: z.enum(["friends", "class"], { error: "Pick friends or class" }),
});

/** Accepts messy input (case, spaces, dashes) and outputs the clean 8 character code. */
export const inviteCodeSchema = z.string().transform((v, ctx) => {
  const code = normalizeInviteCode(v);
  if (!code) {
    ctx.addIssue({ code: "custom", message: "That invite code does not look right" });
    return z.NEVER;
  }
  return code;
});

export const joinGroupSchema = z.object({ code: inviteCodeSchema });

export type CreateGroupInput = z.input<typeof createGroupSchema>;
