import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "@/lib/env";

export const PHOTOS_BUCKET = "photos";
const URL_TTL_SECONDS = 300;

let client: S3Client | undefined;

/**
 * Builds the S3 client on first call. Throws MissingEnvError if the Neon
 * storage variables are missing. Neon needs path-style addressing.
 */
export function getStorage(): S3Client {
  client ??= new S3Client({
    forcePathStyle: true,
    endpoint: requireEnv("AWS_ENDPOINT_URL_S3"),
    region: requireEnv("AWS_REGION"),
    credentials: {
      accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

/** Presigned PUT URL (5 minutes). The content type is part of the signature. */
export function presignPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    getStorage(),
    new PutObjectCommand({ Bucket: PHOTOS_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

/** Presigned GET URL (5 minutes). */
export function presignGet(key: string): Promise<string> {
  return getSignedUrl(getStorage(), new GetObjectCommand({ Bucket: PHOTOS_BUCKET, Key: key }), {
    expiresIn: URL_TTL_SECONDS,
  });
}

/** Size and type of an object, or null if it does not exist. */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const res = await getStorage().send(new HeadObjectCommand({ Bucket: PHOTOS_BUCKET, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/** Deletes an object. Deleting a missing key is not an error in S3. */
export async function deleteObject(key: string): Promise<void> {
  await getStorage().send(new DeleteObjectCommand({ Bucket: PHOTOS_BUCKET, Key: key }));
}

/** Best-effort delete: logs and swallows every error (including missing env). */
export async function deleteObjectQuietly(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await deleteObject(key);
  } catch (err) {
    console.error("Could not delete photo object", key, err);
  }
}
