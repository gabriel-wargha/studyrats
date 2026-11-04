import Link from "next/link";
import { outlineButton, pageShell, primaryButton } from "@/components/ui";

// Same screen for "no such group" and "not your group", so nothing leaks.
export default function GroupNotFound() {
  return (
    <main className={pageShell + " justify-center"}>
      <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight">
        Group not found
      </h1>
      <p className="mt-3 max-w-[34ch] text-base leading-6 text-muted">
        This group does not exist, or you are not a member. Ask a member for an invite code to join.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link href="/groups" className={primaryButton}>
          Back to groups
        </Link>
        <Link href="/join" className={outlineButton}>
          Enter invite code
        </Link>
      </div>
    </main>
  );
}
