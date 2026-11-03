import { randomUUID } from "node:crypto";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** The only prefix a user may attach for one session: `u/{userId}/s/{sessionId}/`. */
export function photoKeyPrefix(userId: string, sessionId: string): string {
  return `u/${userId}/s/${sessionId}/`;
}

/** A fresh key: `u/{userId}/s/{sessionId}/{uuid}.jpg`. */
export function buildPhotoKey(userId: string, sessionId: string): string {
  return `${photoKeyPrefix(userId, sessionId)}${randomUUID()}.jpg`;
}

/** True only for `{prefix}{uuid}.jpg` (nothing else may follow the prefix). */
export function isValidPhotoKey(userId: string, sessionId: string, key: string): boolean {
  const prefix = photoKeyPrefix(userId, sessionId);
  if (!key.startsWith(prefix)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i.test(
    key.slice(prefix.length),
  );
}
