import { randomUUID } from "node:crypto";

export const PHOTO_CONTENT_TYPE = "image/jpeg";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Every object for this user and session lives under this prefix. */
export function photoKeyPrefix(userId: string, sessionId: string): string {
  return `u/${userId}/s/${sessionId}/`;
}

/** New unique key: `u/{userId}/s/{sessionId}/{uuid}.jpg`. */
export function buildPhotoKey(userId: string, sessionId: string): string {
  return `${photoKeyPrefix(userId, sessionId)}${randomUUID()}.jpg`;
}

const FILE_PART = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

/** True only for a key this user could have been given for this session. */
export function isValidPhotoKey(key: unknown, userId: string, sessionId: string): key is string {
  if (typeof key !== "string") return false;
  const prefix = photoKeyPrefix(userId, sessionId);
  return key.startsWith(prefix) && FILE_PART.test(key.slice(prefix.length));
}
