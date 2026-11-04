"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import {
  attachPhoto as attachPhotoImpl,
  createPhotoUpload as createPhotoUploadImpl,
} from "@/server/photos";

/**
 * Input: session id. Returns { key, url, contentType, maxBytes }.
 * The browser must PUT the JPEG to `url` with header Content-Type: image/jpeg.
 */
export async function createPhotoUpload(sessionId: unknown) {
  const user = await requireUser("/study");
  return createPhotoUploadImpl(user.id, sessionId);
}

/** Input: { sessionId, key } (the key from createPhotoUpload). Returns { photoKey }. */
export async function attachPhoto(input: unknown) {
  const user = await requireUser("/study");
  const result = await attachPhotoImpl(user.id, input);
  if (result.ok) {
    revalidatePath("/study");
    revalidatePath("/groups");
  }
  return result;
}
