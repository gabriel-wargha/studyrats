import { z } from "zod";

export const createPhotoUploadSchema = z.object({ sessionId: z.uuid() });

export const attachPhotoSchema = z.object({
  sessionId: z.uuid(),
  key: z.string().min(1).max(200),
});
