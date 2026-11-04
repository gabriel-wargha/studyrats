"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { errorClass, inputClass, primaryButton } from "@/components/ui";
import { isValidInviteCode, normalizeInviteCode } from "@/lib/invite-code";

export function JoinCodeForm() {
  const router = useRouter();
  const ids = { code: useId(), error: useId() };
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const raw = String(new FormData(e.currentTarget).get("code") ?? "");
    const code = normalizeInviteCode(raw);
    if (!code) return setError("Enter the invite code.");
    if (!isValidInviteCode(code)) {
      return setError("Invite codes have 8 letters and numbers. Check the code and try again.");
    }
    setError(null);
    setPending(true);
    router.push(`/join/${code}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
      {error && (
        <p id={ids.error} role="alert" className={errorClass}>
          {error}
        </p>
      )}
      <div>
        <label htmlFor={ids.code} className="font-semibold">
          Invite code
        </label>
        <input
          id={ids.code}
          name="code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          placeholder="K7M2 QX9R"
          aria-invalid={!!error}
          aria-describedby={error ? ids.error : undefined}
          className={`${inputClass} font-display text-2xl font-bold tracking-[0.2em] uppercase`}
        />
      </div>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Finding group..." : "Find group"}
      </button>
    </form>
  );
}
