import type { Metadata } from "next";

export const metadata: Metadata = { title: "Feed" };

/** PLACEHOLDER until F7 builds the feed. Exists so create/join redirects do not 404. */
export default function GroupFeedPage() {
  return (
    <section className="rounded-2xl bg-white p-6 ring-2 ring-rule">
      <h2 className="font-display text-2xl font-bold">Feed coming soon</h2>
      <p className="mt-2 max-w-[34ch] text-lg leading-snug text-pencil">
        Check-ins from your group will show up here.
      </p>
    </section>
  );
}
