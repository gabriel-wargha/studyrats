"use client";

import { useEffect, useRef, useState } from "react";
import { attachPhoto, createPhotoUpload } from "@/app/actions/photos";
import { JPEG_QUALITY, MAX_PHOTO_EDGE, fitWithin } from "@/lib/image-size";

type Status =
  | { kind: "idle" }
  | { kind: "resizing" }
  | { kind: "uploading"; percent: number }
  | { kind: "saving" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/** Shrinks the picked image and re-encodes it as JPEG. This also drops EXIF and location data. */
async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_PHOTO_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    bitmap.close();
  }
}

/** fetch has no upload progress, so the PUT uses XMLHttpRequest. */
function putBlob(url: string, blob: Blob, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "image/jpeg");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`status ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(blob);
  });
}

const actionButton =
  "inline-flex min-h-12 items-center justify-center rounded-2xl border-2 border-ink px-5 text-base font-semibold text-foreground disabled:opacity-60";

/**
 * Optional photo of your notes for one study session.
 * Pick, shrink, get an upload URL, PUT to storage, then attach to the session.
 */
export function PhotoPicker({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [hasPhoto, setHasPhoto] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [retryBlob, setRetryBlob] = useState<Blob | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const busy = status.kind === "resizing" || status.kind === "uploading" || status.kind === "saving";

  async function upload(blob: Blob) {
    setStatus({ kind: "uploading", percent: 0 });
    try {
      // A fresh URL on every try, because a presigned URL expires after 5 minutes.
      const created = await createPhotoUpload({ sessionId });
      if (!created.ok) {
        setStatus({ kind: "error", message: created.error });
        return;
      }
      await putBlob(created.data.url, blob, (percent) => setStatus({ kind: "uploading", percent }));
      setStatus({ kind: "saving" });
      const attached = await attachPhoto({ sessionId, key: created.data.key });
      if (!attached.ok) {
        setStatus({ kind: "error", message: attached.error });
        return;
      }
      setHasPhoto(true);
      setRetryBlob(null);
      setStatus({ kind: "done" });
    } catch {
      setStatus({
        kind: "error",
        message: "Upload failed. Check your connection and try again.",
      });
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same photo be picked again
    if (!file || busyRef.current) return;
    busyRef.current = true;
    try {
      setStatus({ kind: "resizing" });
      let blob: Blob;
      try {
        blob = await resizeToJpeg(file);
      } catch {
        setStatus({ kind: "error", message: "Could not read that photo. Pick a different one." });
        return;
      }
      setRetryBlob(blob);
      setPreview(URL.createObjectURL(blob));
      await upload(blob);
    } finally {
      busyRef.current = false;
    }
  }

  async function onRetry() {
    const blob = retryBlob;
    if (!blob || busyRef.current) return;
    busyRef.current = true;
    try {
      await upload(blob);
    } finally {
      busyRef.current = false;
    }
  }

  const canRetry = status.kind === "error" && retryBlob !== null;

  return (
    <div className="rounded-3xl border-2 border-line bg-surface p-4">
      <div className="flex items-center gap-4">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL, nothing to optimize
          <img
            src={preview}
            alt="Preview of your notes"
            className="size-16 shrink-0 rounded-2xl border-2 border-line object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Photo of your notes</p>
          <p className="text-sm text-muted">
            {hasPhoto ? "Added to your check-in" : "Optional. Group members can see it."}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        hidden
      />

      {busy && (
        <div
          role="progressbar"
          aria-label="Photo upload"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={status.kind === "uploading" ? status.percent : undefined}
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-cheese transition-[width] motion-reduce:transition-none"
            style={{
              width: status.kind === "uploading" ? `${Math.max(status.percent, 4)}%` : "100%",
            }}
          />
        </div>
      )}

      <p role="status" className="mt-2 min-h-5 text-sm text-muted">
        {status.kind === "resizing" && "Preparing photo..."}
        {status.kind === "uploading" && `Uploading ${status.percent}%`}
        {status.kind === "saving" && "Saving..."}
        {status.kind === "done" && "Photo saved"}
      </p>

      {status.kind === "error" && (
        <p
          role="alert"
          className="mt-2 rounded-2xl border-2 border-[#c2410c] px-4 py-3 text-sm font-medium text-[#c2410c] dark:border-[#fb923c] dark:text-[#fb923c]"
        >
          {status.message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={actionButton}
        >
          {hasPhoto ? "Replace photo" : preview ? "Pick another photo" : "Add photo"}
        </button>
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={actionButton + " bg-cheese text-[#12203a]"}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
