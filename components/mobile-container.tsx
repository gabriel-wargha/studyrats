import type { ReactNode } from "react";

/** One centred column, about 480 px wide, used by every screen. */
export function MobileContainer({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "main";
}) {
  return (
    <Tag className={`mx-auto w-full max-w-[480px] px-5 ${className}`}>
      {children}
    </Tag>
  );
}
