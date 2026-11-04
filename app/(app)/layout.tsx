import { Suspense, type ReactNode } from "react";
import { MobileContainer } from "@/components/mobile-container";
import { TabBar } from "@/components/tab-bar";

/** Shell for signed-in screens: one column plus the bottom tab bar. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MobileContainer as="main" className="min-h-dvh pt-6 pb-28">
        {children}
      </MobileContainer>
      {/* usePathname() is runtime data on dynamic routes, so it streams in. */}
      <Suspense
        fallback={
          <div
            aria-hidden
            className="fixed inset-x-0 bottom-0 z-10 h-16 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]"
          />
        }
      >
        <TabBar />
      </Suspense>
    </>
  );
}
