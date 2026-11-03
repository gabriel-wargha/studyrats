import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "@/lib/env";

export const PHOTO_BUCKET = "photos";
export const PRESIGN_EXPIRES_SECONDS = 300;

let client: S3Client | undefined;

/** Builds the S3 client on first use (never at import). Neon needs path-style addressing. */
function getS3(): S3Client {
  if (!client) {
    client = new S3Client({
      forcePathStyle: true,
      region: requireEnv("AWS_REGION"),
      endpoint: requireEnv("AWS_ENDPOINT_URL_S3"),
      credentials: {
        accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

/** Presigned PUT URL (5 minutes) for uploading one object. */
export async function presignPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    getS3(),
    new PutObjectCommand({ Bucket: PHOTO_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );
}

/** Presigned GET URL (5 minutes) for viewing one object. */
export async function presignGet(key: string): Promise<string> {
  return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: PHOTO_BUCKET, Key: key }), {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
  });
}

/** Size and type of an object, or null if it does not exist. */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const res = await getS3().send(new HeadObjectCommand({ Bucket: PHOTO_BUCKET, Key: key }));
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
  await getS3().send(new DeleteObjectCommand({ Bucket: PHOTO_BUCKET, Key: key }));
}
