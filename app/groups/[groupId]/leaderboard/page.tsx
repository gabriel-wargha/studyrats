import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Leaderboard" };

// PLACEHOLDER: F8 replaces this page with the real leaderboard.
export default function LeaderboardPlaceholder() {
  return (
    <EmptyState title="Leaderboard coming soon">
      Weekly and all-time points will show up here.
    </EmptyState>
  );
}
