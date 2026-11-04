import { connection } from "next/server";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/server";

/** Server-side login check. Render inside <Suspense>, because it reads cookies. */
export async function AuthGate({
  returnPath,
  children,
}: {
  returnPath: string;
  children: ReactNode;
}) {
  await connection(); // per-request: never run auth during prerender
  await requireUser(returnPath);
  return <>{children}</>;
}
