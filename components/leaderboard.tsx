import Link from "next/link";
import type { LeaderboardRange, LeaderboardRow } from "@/lib/queries/leaderboard";

const RANGES: { value: LeaderboardRange; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];

export function RangeToggle({ basePath, range }: { basePath: string; range: LeaderboardRange }) {
  return (
    <nav aria-label="Leaderboard period">
      <ul className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-line bg-surface p-1">
        {RANGES.map(({ value, label }) => {
          const active = value === range;
          return (
            <li key={value}>
              <Link
                href={`${basePath}?range=${value}`}
                replace
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={
                  "flex min-h-11 items-center justify-center rounded-xl px-2 text-sm font-semibold " +
                  (active ? "bg-ink text-background" : "text-muted")
                }
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function LeaderboardList({
  rows,
  myUserId,
}: {
  rows: LeaderboardRow[];
  myUserId: string;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row) => {
        const mine = row.userId === myUserId;
        return (
          <li
            key={row.userId}
            aria-current={mine ? "true" : undefined}
            className={
              "flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-2 " +
              (mine ? "border-cheese bg-cheese text-[#12203a]" : "border-line bg-surface")
            }
          >
            <span
              className="w-7 shrink-0 text-center font-display text-xl font-extrabold tabular-nums"
              aria-label={`Rank ${row.rank}`}
            >
              {row.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-base font-semibold">
              {row.displayName}
              {mine && <span className="ml-1.5 font-medium">(you)</span>}
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="font-display text-xl font-extrabold">
                {row.points.toLocaleString("en-US")}
              </span>
              <span className={"ml-1 text-sm " + (mine ? "" : "text-muted")}>pts</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
