"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { outlineButton, primaryButton } from "@/components/ui";

const noopSubscribe = () => () => {};

export function InviteActions({ code, groupName }: { code: string; groupName: string }) {
  // Web Share is missing on most desktop browsers; false on the server.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function announce(message: string) {
    setStatus(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), 3000);
  }

  const link = () => `${window.location.origin}/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      announce("Link copied");
    } catch {
      announce("Could not copy. Select the code above and share it by hand.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `Join ${groupName} on StudyRats`,
        text: `Join ${groupName} on StudyRats. Invite code: ${code}`,
        url: link(),
      });
    } catch (err) {
      // Closing the share sheet is not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      announce("Could not open the share menu. Use Copy link instead.");
    }
  }

  return (
    <div>
      <div className={"grid gap-3 " + (canShare ? "grid-cols-2" : "grid-cols-1")}>
        <button type="button" onClick={copy} className={primaryButton}>
          Copy link
        </button>
        {canShare && (
          <button type="button" onClick={share} className={outlineButton}>
            Share
          </button>
        )}
      </div>
      <p role="status" className="mt-3 min-h-6 text-center text-sm font-medium text-muted">
        {status}
      </p>
    </div>
  );
}
