"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { joinGroup } from "@/app/actions/groups";
import { FormError, primaryButton } from "@/components/ui";

export function JoinConfirm({ code }: { code: string }) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onJoin() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await joinGroup({ code });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/groups/${result.data.groupId}`);
      } catch {
        setError("Could not join the group. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="mt-8 space-y-4">
      <FormError id={errorId} message={error} />
      <button type="button" onClick={onJoin} disabled={pending} className={primaryButton}>
        {pending ? "Joining..." : "Join group"}
      </button>
    </div>
  );
}
