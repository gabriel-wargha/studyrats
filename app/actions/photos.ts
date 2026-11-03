"use server";

import { requireUser } from "@/lib/auth/server";
import * as photosServer from "@/server/photos";

export async function createPhotoUpload(input: unknown) {
  const user = await requireUser("/study");
  return photosServer.createPhotoUpload(user.id, input);
}

export async function attachPhoto(input: unknown) {
  const user = await requireUser("/study");
  return photosServer.attachPhoto(user.id, input);
}
