import { z } from "zod";

/** Trimmed, 1 to 40 characters (matches profiles_display_name_len). */
export const updateDisplayNameSchema = z.object({
  displayName: z
    .string({ error: "Enter a display name" })
    .trim()
    .min(1, "Enter a display name")
    .refine((v) => Array.from(v).length <= 40, "Name is at most 40 characters"),
});
