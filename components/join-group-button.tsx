"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { joinGroup } from "@/app/actions/groups";
import { errorClass, primaryButton } from "@/components/ui";

export function JoinGroupButton({ code }: { code: string }) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onJoin() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await joinGroup(code);
        if (!res.ok) return setError(res.error);
        router.push(`/groups/${res.data.groupId}`);
      } catch {
        setError("Can't reach StudyRats. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p id={errorId} role="alert" className={errorClass}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onJoin}
        disabled={pending}
        aria-describedby={error ? errorId : undefined}
        className={primaryButton}
      >
        {pending ? "Joining..." : "Join group"}
      </button>
    </div>
  );
}
