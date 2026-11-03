"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { FormError, fieldClass, primaryButton } from "@/components/ui";

/** Case, spaces and dashes never matter. The server maps look-alike letters. */
function clean(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export function JoinCodeForm() {
  const router = useRouter();
  const ids = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = clean(code);
    if (value.length !== 8) {
      setError("Invite codes have 8 characters. Check the code and try again.");
      return;
    }
    setError(null);
    router.push(`/join/${encodeURIComponent(value)}`);
  }

  const errorId = `${ids}-error`;

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6" noValidate>
      <div>
        <label htmlFor={`${ids}-code`} className="text-sm font-semibold">
          Invite code
        </label>
        <input
          id={`${ids}-code`}
          name="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          placeholder="K7M2QX9D"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={fieldClass + " text-center font-display text-2xl font-bold tracking-[0.2em]"}
        />
      </div>
      <FormError id={errorId} message={error} />
      <button type="submit" className={primaryButton}>
        Find group
      </button>
    </form>
  );
}
