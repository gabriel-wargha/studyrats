import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Feed, toFeedItemData } from "@/components/feed";
import { EmptyState, Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/authz";
import { getFeed } from "@/lib/queries/feed";

export const metadata: Metadata = { title: "Feed" };

export default function GroupFeedPage({ params }: PageProps<"/groups/[groupId]">) {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedContent params={params} />
    </Suspense>
  );
}

async function FeedContent({ params }: { params: PageProps<"/groups/[groupId]">["params"] }) {
  // Render at request time before touching auth or the database.
  await connection();
  const { groupId } = await params;
  const ctx = await requireMember(groupId);
  const page = await getFeed(ctx);

  if (page.items.length === 0) {
    return (
      <EmptyState title="No check-ins yet">
        Start a study session and your first check-in will show up here.
      </EmptyState>
    );
  }

  return (
    <Feed
      groupId={ctx.groupId}
      initialItems={toFeedItemData(page.items)}
      initialCursor={page.nextCursor}
      serverNow={serverNowMs()}
    />
  );
}

function serverNowMs(): number {
  return Date.now();
}

function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading feed" className="flex flex-col gap-4">
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}
