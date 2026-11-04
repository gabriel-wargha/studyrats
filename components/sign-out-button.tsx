"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError, outlineButton } from "@/components/ui";
import { signOut } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await signOut();
        if (result?.error) {
          setError("Could not sign out. Try again.");
          return;
        }
        router.replace("/");
        router.refresh();
      } catch {
        setError("Could not sign out. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <FormError id="sign-out-error" message={error} />
      <button type="button" onClick={onClick} disabled={pending} className={outlineButton}>
        {pending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
