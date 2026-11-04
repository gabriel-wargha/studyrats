"use client";

import { useState, useSyncExternalStore } from "react";
import { primaryButton, secondaryButton } from "@/components/ui";

const noopSubscribe = () => () => {};

/** Copy link and Web Share buttons for an invite code. */
export function InviteActions({ code, groupName }: { code: string; groupName: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  // Web Share only exists in some browsers; false on the server and first paint.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  const link = () => `${window.location.origin}/join/${encodeURIComponent(code)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `Join ${groupName} on StudyRats`,
        text: `Join ${groupName} on StudyRats with code ${code}.`,
        url: link(),
      });
    } catch {
      // Closing the share sheet rejects with AbortError; nothing to report.
    }
  }

  return (
    <div>
      <div className={`grid gap-3 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
        <button type="button" onClick={copy} className={primaryButton}>
          Copy link
        </button>
        {canShare && (
          <button type="button" onClick={share} className={secondaryButton}>
            Share
          </button>
        )}
      </div>
      <p
        role="status"
        className={`mt-3 min-h-6 text-center font-semibold ${status === "failed" ? "text-red-900" : "text-chalk"}`}
      >
        {status === "copied" && "Link copied"}
        {status === "failed" && "Could not copy. Select the code and send it instead."}
      </p>
    </div>
  );
}
