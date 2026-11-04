import type { ReactNode } from "react";
import { MobileContainer } from "@/components/mobile-container";
import { TabBar } from "@/components/tab-bar";

/** Shell for signed-in screens: one column plus the bottom tab bar. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MobileContainer as="main" className="min-h-dvh pt-6 pb-28">
        {children}
      </MobileContainer>
      <TabBar />
    </>
  );
}
