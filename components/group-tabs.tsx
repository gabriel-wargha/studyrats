"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const base = `/groups/${groupId}`;
  const tabs = [
    { href: base, label: "Feed" },
    { href: `${base}/leaderboard`, label: "Leaderboard" },
    { href: `${base}/invite`, label: "Invite" },
  ];

  return (
    <nav aria-label="Group sections" className="mt-5">
      <ul className="grid grid-cols-3 gap-1 rounded-2xl border-2 border-line bg-surface p-1">
        {tabs.map(({ href, label }) => {
          const active = pathname === href || pathname === href + "/";
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex min-h-11 items-center justify-center rounded-xl px-2 text-sm font-semibold " +
                  (active ? "bg-cheese text-[#12203a]" : "text-muted")
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
