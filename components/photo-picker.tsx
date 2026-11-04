"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { attachPhoto, createPhotoUpload } from "@/app/actions/photos";
import { errorClass, secondaryButton } from "@/components/ui";
import { resizeToJpeg } from "@/lib/image-resize";

type Stage = "resizing" | "uploading" | "saving";

const STAGE_LABEL: Record<Stage, string> = {
  resizing: "Preparing photo...",
  uploading: "Uploading",
  saving: "Saving...",
};

/** PUT with progress. fetch cannot report upload progress, so this uses XHR. */
function putBlob(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Upload failed (" + xhr.status + ")"));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(blob);
  });
}

/**
 * Pick a photo of your notes, shrink it, upload it straight to storage and
 * attach it to the session. `attached` and `onAttached` live in the parent so
 * the result survives the page re-render after attachPhoto.
 */
export function PhotoPicker({
  sessionId,
  attached,
  onAttached,
}: {
  sessionId: string;
  attached: boolean;
  onAttached: () => void;
}) {
  const ids = { input: useId(), error: useId() };
  const inputRef = useRef<HTMLInputElement>(null);
  // The file that failed, kept so retry does not need it picked again.
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = stage !== null;

  async function run(file: File) {
    setError(null);
    setFailedFile(null);
    setProgress(0);
    try {
      setStage("resizing");
      const blob = await resizeToJpeg(file);

      setStage("uploading");
      const created = await createPhotoUpload(sessionId);
      if (!created.ok) throw new Error(created.error);
      await putBlob(created.data.url, blob, "image/jpeg", setProgress);

      setStage("saving");
      const res = await attachPhoto({ sessionId, key: created.data.key });
      if (!res.ok) throw new Error(res.error);

      onAttached();
    } catch (e) {
      setFailedFile(file);
      setError(
        e instanceof Error && e.message
          ? e.message + ". Try again."
          : "Could not add the photo. Try again.",
      );
    } finally {
      setStage(null);
    }
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file || busy) return;
    void run(file);
  }

  const percent = Math.round(progress * 100);

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={ids.input}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {error && (
        <div id={ids.error} role="alert" className={errorClass}>
          <p>{error}</p>
          {failedFile && (
            <button
              type="button"
              onClick={() => void run(failedFile)}
              className="mt-2 min-h-11 font-bold underline underline-offset-4"
            >
              Retry upload
            </button>
          )}
        </div>
      )}

      {busy && (
        <div role="status" className="rounded-xl px-4 py-3 ring-2 ring-rule">
          <p className="font-semibold">
            {STAGE_LABEL[stage]}
            {stage === "uploading" ? " " + percent + "%" : ""}
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-rule"
            role="progressbar"
            aria-label="Photo upload"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stage === "uploading" ? percent : stage === "saving" ? 100 : 0}
          >
            <div
              className="h-full bg-chalk transition-[width] motion-reduce:transition-none"
              style={{ width: (stage === "resizing" ? 0 : stage === "saving" ? 100 : percent) + "%" }}
            />
          </div>
        </div>
      )}

      {attached && !busy && (
        <p role="status" className="rounded-xl bg-highlighter px-4 py-3 font-semibold text-ink">
          Photo added to this session.
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-describedby={error ? ids.error : undefined}
        className={secondaryButton + " disabled:opacity-60"}
      >
        {attached ? "Replace photo" : "Add photo of your notes"}
      </button>
    </div>
  );
}
