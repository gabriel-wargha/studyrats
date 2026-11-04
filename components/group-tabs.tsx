"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Feed / Leaderboard / Invite tabs for one group. Needs a Suspense parent (usePathname). */
export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const base = `/groups/${groupId}`;
  const tabs = [
    { href: base, label: "Feed" },
    { href: `${base}/leaderboard`, label: "Leaderboard" },
    { href: `${base}/invite`, label: "Invite" },
  ];

  return (
    <nav aria-label="Group" className="mt-5">
      <ul className="flex gap-1 rounded-2xl bg-rule/60 p-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center rounded-xl px-2 text-base font-semibold ${
                  active ? "bg-chalk text-paper" : "text-pencil"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
