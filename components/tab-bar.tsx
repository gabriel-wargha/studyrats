"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const svgProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const tabs: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/groups",
    label: "Groups",
    icon: (
      <svg {...svgProps}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M16 5.5a3 3 0 0 1 0 5M18 14.3c1.7.8 3 2.6 3 5.7" />
      </svg>
    ),
  },
  {
    href: "/study",
    label: "Study",
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9.5 2h5" />
      </svg>
    ),
  },
  {
    href: "/me",
    label: "Me",
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    ),
  },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-[480px]">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const isStudy = tab.href === "/study";
          const pill = isStudy
            ? `bg-highlighter text-ink ${active ? "ring-2 ring-ink" : ""}`
            : active
              ? "bg-chalk text-paper"
              : "";
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-semibold ${
                  active || isStudy ? "text-ink" : "text-pencil"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full ${pill}`}
                >
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
