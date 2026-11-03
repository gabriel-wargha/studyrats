import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Feed" };

// PLACEHOLDER: F7 replaces this page with the real check-in feed.
export default function GroupFeedPlaceholder() {
  return (
    <EmptyState title="Feed coming soon">
      Check-ins from your group will show up here.
    </EmptyState>
  );
}
