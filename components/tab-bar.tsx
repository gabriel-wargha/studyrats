"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/groups", label: "Groups", icon: GroupsIcon },
  { href: "/study", label: "Study", icon: StudyIcon },
  { href: "/me", label: "Me", icon: MeIcon },
] as const;

// Routes that belong to the signed-in app. Landing and auth pages get no tabs.
const APP_PREFIXES = ["/groups", "/study", "/me", "/join"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function TabBar() {
  const pathname = usePathname();
  if (!APP_PREFIXES.some((p) => matches(pathname, p))) return null;

  return (
    <>
      {/* Spacer so page content never hides behind the fixed bar. */}
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        <ul className="mx-auto flex h-16 max-w-[480px] items-stretch">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = matches(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex h-full min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 text-xs font-medium " +
                    (active ? "text-foreground" : "text-muted")
                  }
                >
                  <span
                    className={
                      "flex h-7 w-12 items-center justify-center rounded-full " +
                      (active ? "bg-cheese text-[#12203a]" : "")
                    }
                  >
                    <Icon />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function GroupsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.4c2 .7 3.5 2.5 3.5 5.6" />
    </svg>
  );
}

function StudyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9.5 2.5h5" />
    </svg>
  );
}

function MeIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}
