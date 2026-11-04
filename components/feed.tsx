"use client";

import { useOptimistic, useState, useTransition } from "react";
import { loadMoreFeed, toggleReaction } from "@/app/actions/reactions";
import { FormError, outlineButton } from "@/components/ui";
import type { FeedItem, ReactionKind } from "@/lib/queries/feed";
import { timeAgo } from "@/lib/time-ago";

// Items cross the server/client boundary as plain data (dates as ISO strings).
export type FeedItemData = Omit<FeedItem, "endedAt"> & { endedAt: string };

const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "fire", emoji: "\u{1F525}", label: "Fire" },
  { kind: "clap", emoji: "\u{1F44F}", label: "Clap" },
  { kind: "brain", emoji: "\u{1F9E0}", label: "Big brain" },
  { kind: "muscle", emoji: "\u{1F4AA}", label: "Strong work" },
];

export function toFeedItemData(items: FeedItem[]): FeedItemData[] {
  return items.map((i) => ({ ...i, endedAt: new Date(i.endedAt).toISOString() }));
}

export function Feed({
  groupId,
  initialItems,
  initialCursor,
  serverNow,
}: {
  groupId: string;
  initialItems: FeedItemData[];
  initialCursor: string | null;
  serverNow: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [now, setNow] = useState(serverNow);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const res = await loadMoreFeed({ groupId, cursor });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Server action results serialize Dates as Dates, so normalise again.
      const next = toFeedItemData(res.data.items);
      const seen = new Set(items.map((i) => i.id));
      setItems((prev) => [...prev, ...next.filter((i) => !seen.has(i.id))]);
      setCursor(res.data.nextCursor);
      setNow(Date.now());
    });
  }

  return (
    <div>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <CheckInCard item={item} now={now} />
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <FormError id="feed-error" message={error} />
        {cursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            aria-describedby="feed-error"
            className={outlineButton + " mt-3 disabled:opacity-60"}
          >
            {pending ? "Loading..." : "Load more"}
          </button>
        ) : (
          <p className="mt-3 text-center text-sm text-muted">You are all caught up.</p>
        )}
      </div>
    </div>
  );
}

type ReactionState = { counts: Record<ReactionKind, number>; mine: ReactionKind[] };

function applyToggle(state: ReactionState, kind: ReactionKind): ReactionState {
  const on = state.mine.includes(kind);
  return {
    counts: { ...state.counts, [kind]: Math.max(0, state.counts[kind] + (on ? -1 : 1)) },
    mine: on ? state.mine.filter((k) => k !== kind) : [...state.mine, kind],
  };
}

function CheckInCard({ item, now }: { item: FeedItemData; now: number }) {
  const [base, setBase] = useState<ReactionState>({
    counts: item.reactionCounts,
    mine: item.myReactions,
  });
  const [optimistic, toggleOptimistic] = useOptimistic(base, applyToggle);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  function toggle(kind: ReactionKind) {
    setError(null);
    startTransition(async () => {
      toggleOptimistic(kind);
      const res = await toggleReaction({ sessionId: item.id, kind });
      if (res.ok) {
        // Commit the confirmed result; the optimistic value is dropped when the transition ends.
        setBase((prev) => {
          const on = prev.mine.includes(kind);
          return res.data.active === on ? prev : applyToggle(prev, kind);
        });
      } else {
        // Base state is unchanged, so the optimistic toggle rolls back by itself.
        setError(res.error);
      }
    });
  }

  const initial = item.displayName.trim().charAt(0).toUpperCase() || "?";
  const minutesLabel = `${item.minutes} ${item.minutes === 1 ? "minute" : "minutes"}`;

  return (
    <article className="rounded-3xl border-2 border-line bg-surface p-4">
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-background"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{item.displayName}</p>
          <time dateTime={item.endedAt} className="text-sm text-muted">
            {timeAgo(item.endedAt, now)}
          </time>
        </div>
        <p className="shrink-0 rounded-full bg-cheese px-3 py-1 text-sm font-bold text-[#12203a]">
          {item.minutes} {item.minutes === 1 ? "pt" : "pts"}
        </p>
      </header>

      <p className="mt-3 text-base leading-6">
        {item.subject ? (
          <>
            Studied <strong>{item.subject}</strong> for {minutesLabel}
          </>
        ) : (
          <>Studied for {minutesLabel}</>
        )}
      </p>

      {item.hasPhoto && !photoFailed && (
        // eslint-disable-next-line @next/next/no-img-element -- private route that redirects to a presigned URL
        <img
          src={`/api/photos/${item.id}`}
          alt={`Study notes from ${item.displayName}`}
          loading="lazy"
          decoding="async"
          onError={() => setPhotoFailed(true)}
          className="mt-3 aspect-[4/3] w-full rounded-2xl bg-line object-cover"
        />
      )}

      <div role="group" aria-label="Reactions" className="mt-3 flex flex-wrap gap-2">
        {REACTIONS.map(({ kind, emoji, label }) => {
          const active = optimistic.mine.includes(kind);
          const count = optimistic.counts[kind];
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={active}
              aria-label={`${label}, ${count}`}
              onClick={() => toggle(kind)}
              className={
                "flex min-h-11 min-w-14 items-center justify-center gap-1.5 rounded-full border-2 px-3 text-base font-semibold " +
                (active ? "border-cheese bg-cheese text-[#12203a]" : "border-line text-foreground")
              }
            >
              <span aria-hidden>{emoji}</span>
              <span aria-hidden className="tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-[#c2410c] dark:text-[#fb923c]">
          {error}
        </p>
      )}
    </article>
  );
}
