import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { JoinConfirm } from "@/components/join-confirm";
import { PageHeader, Skeleton, TypeBadge, outlineButton, pageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/server";
import { getGroupByInviteCode } from "@/lib/queries/groups";

export const metadata: Metadata = { title: "Join a group" };

export default function JoinCodePage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className={pageShell}>
      <Suspense fallback={<JoinSkeleton />}>
        <JoinPreview params={params} />
      </Suspense>
    </main>
  );
}

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function JoinPreview({ params }: { params: PageProps<"/join/[code]">["params"] }) {
  // Render at request time before touching auth or the database.
  await connection();
  const code = decode((await params).code);
  // Logged-out users go to /sign-in?next=/join/<code> and come back here afterwards.
  await requireUser(`/join/${encodeURIComponent(code)}`);
  const group = await getGroupByInviteCode(code);

  if (!group) {
    return (
      <>
        <PageHeader title="Code not found" back={{ href: "/groups", label: "Back to groups" }}>
          <p className="mt-3 max-w-[34ch] text-base leading-6 text-muted">
            No group matches that invite code. Ask for a new link, or type the code again.
          </p>
        </PageHeader>
        <Link href="/join" className={outlineButton + " mt-8"}>
          Enter a code
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Join this group?" back={{ href: "/join", label: "Use a different code" }} />
      <section
        aria-label="Group preview"
        className="mt-6 rounded-3xl border-2 border-line bg-surface px-5 py-6"
      >
        <h2 className="break-words font-display text-3xl font-extrabold leading-tight tracking-tight">
          {group.name}
        </h2>
        <div className="mt-3 flex items-center gap-3 text-base text-muted">
          <TypeBadge type={group.type} />
          <span>
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
      </section>
      <JoinConfirm code={code} />
    </>
  );
}

function JoinSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading group">
      <Skeleton className="h-11 w-40" />
      <Skeleton className="mt-4 h-24 rounded-3xl" />
      <Skeleton className="mt-8 h-12" />
    </div>
  );
}
