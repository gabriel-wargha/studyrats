"use client";

import { useId, useState, useTransition } from "react";
import { updateDisplayName } from "@/app/actions/profiles";
import { FormError, fieldClass, primaryButton } from "@/components/ui";

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const ids = useId();
  const [saved, setSaved] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const displayName = String(new FormData(event.currentTarget).get("displayName") ?? "");
    setError(null);
    setFieldError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await updateDisplayName({ displayName });
        if (!result.ok) {
          const message = result.fieldErrors?.displayName?.[0] ?? null;
          setFieldError(message);
          setError(message ? null : result.error);
          return;
        }
        setSaved(result.data.displayName);
        setNotice("Name saved");
      } catch {
        setError("Could not save your name. Check your connection and try again.");
      }
    });
  }

  const fieldErrorId = `${ids}-field-error`;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor={`${ids}-name`} className="text-sm font-semibold">
          Display name
        </label>
        <input
          id={`${ids}-name`}
          name="displayName"
          type="text"
          required
          maxLength={40}
          autoComplete="nickname"
          // Remount with the saved (trimmed) value after a successful save.
          key={saved}
          defaultValue={saved}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? fieldErrorId : undefined}
          className={fieldClass}
        />
        <div id={fieldErrorId} role="alert">
          {fieldError && (
            <p className="mt-1.5 text-sm font-medium text-[#c2410c] dark:text-[#fb923c]">
              {fieldError}
            </p>
          )}
        </div>
      </div>
      <FormError id={`${ids}-error`} message={error} />
      <p role="status" className="min-h-5 text-sm font-medium text-muted">
        {notice}
      </p>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Saving..." : "Save name"}
      </button>
    </form>
  );
}
