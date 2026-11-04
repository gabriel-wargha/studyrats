import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { GroupTypeBadge } from "@/components/group-type-badge";
import { JoinGroupButton } from "@/components/join-group-button";
import { Skeleton } from "@/components/skeleton";
import { secondaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth/server";
import { normalizeInviteCode } from "@/lib/invite-code";
import { getGroupByInviteCode } from "@/server/groups";

export const metadata: Metadata = { title: "Join a group" };

export default function JoinCodePage({ params }: PageProps<"/join/[code]">) {
  return (
    <Suspense fallback={<JoinSkeleton />}>
      <JoinPreview params={params} />
    </Suspense>
  );
}

async function JoinPreview({ params }: { params: PageProps<"/join/[code]">["params"] }) {
  await connection(); // per-request: never run auth during prerender
  const { code: rawCode } = await params;
  let decoded = rawCode;
  try {
    decoded = decodeURIComponent(rawCode);
  } catch {
    // A malformed escape just fails the code check below.
  }
  const code = normalizeInviteCode(decoded);
  // Logged-out visitors sign in, then come back to this same link.
  await requireUser(`/join/${encodeURIComponent(code)}`);
  const group = await getGroupByInviteCode(code);

  if (!group) {
    return (
      <>
        <h1 className="font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight">
          Code not found
        </h1>
        <p className="mt-3 max-w-[34ch] text-lg leading-snug text-pencil">
          No group uses that invite code. Ask the person who invited you to send it again.
        </p>
        <div className="mt-8">
          <Link href="/join" className={secondaryButton}>
            Try another code
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-lg text-pencil">You are invited to join</p>
      <section className="mt-3 rounded-2xl bg-chalk p-6 text-paper">
        <h1 className="font-display text-[2rem] leading-[1.05] font-extrabold tracking-tight text-balance">
          {group.name}
        </h1>
        <div className="mt-4 flex items-center gap-3">
          <GroupTypeBadge type={group.type} />
          <span className="text-paper/80">
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
      </section>
      <p className="mt-4 text-pencil">
        Members see your name and your study time from the day you join.
      </p>
      <div className="mt-6">
        <JoinGroupButton code={code} />
      </div>
    </>
  );
}

function JoinSkeleton() {
  return (
    <div role="status" aria-label="Loading invite" className="flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-14" />
    </div>
  );
}
