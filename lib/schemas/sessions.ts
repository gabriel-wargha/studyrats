import { z } from "zod";

/** Trimmed, at most 60 characters. Empty or missing becomes null. */
export const subjectSchema = z
  .string()
  .trim()
  .max(60, "Subject is at most 60 characters")
  .nullish()
  .transform((v) => (v ? v : null));

export const startSessionSchema = z.object({ subject: subjectSchema });

export const stopSessionSchema = z.object({ id: z.uuid("That session id does not look right") });

export const updateSubjectSchema = z.object({
  id: z.uuid("That session id does not look right"),
  subject: subjectSchema,
});
