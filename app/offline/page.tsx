import type { Metadata } from "next";
import { pageShell, outlineButton } from "@/components/ui";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className={pageShell + " justify-center"}>
      <h1 className="font-display text-3xl font-bold">You are offline</h1>
      <p className="mt-3 max-w-[34ch] text-base text-muted">
        StudyRats needs a connection to save sessions and load your groups.
        Reconnect, then try again. A timer you already started keeps its time.
      </p>
      {/* A plain anchor forces a real reload, which is what we want here. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/groups" className={outlineButton + " mt-8"}>
        Try again
      </a>
    </main>
  );
}
