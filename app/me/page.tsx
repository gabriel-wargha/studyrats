import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DisplayNameForm } from "@/components/display-name-form";
import { IosInstallTip } from "@/components/ios-install-tip";
import { SignOutButton } from "@/components/sign-out-button";
import { EmptyState, PageHeader, Skeleton, pageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/server";
import { getMySessions } from "@/lib/queries/sessions";
import { getMyStats } from "@/lib/queries/stats";
import { displayNameFor } from "@/server/profiles";

export const metadata: Metadata = { title: "Me" };

export default function MePage() {
  return (
    <main className={pageShell}>
      <PageHeader title="Me" />
      <div className="mt-6 flex flex-col gap-8">
        <Suspense fallback={<MeSkeleton />}>
          <MeContent />
        </Suspense>
        <IosInstallTip />
        <SignOutButton />
      </div>
    </main>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "America/Boise",
});

async function MeContent() {
  // Render at request time before touching auth or the database.
  await connection();
  const user = await requireUser("/me");
  // Own data only: every query is keyed by the signed-in user's id.
  const [stats, sessions] = await Promise.all([getMyStats(user.id), getMySessions(user.id, 20)]);

  return (
    <>
      <DisplayNameForm initialName={displayNameFor(user)} />

      <section aria-label="My points" className="grid grid-cols-2 gap-3">
        <Stat label="This week" value={stats.weekPoints} />
        <Stat label="All time" value={stats.allTimePoints} />
      </section>

      <section aria-labelledby="recent-sessions">
        <h2 id="recent-sessions" className="font-display text-2xl font-bold tracking-tight">
          Recent sessions
        </h2>
        {sessions.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No sessions yet">
              Start the timer on the Study tab to log your first session.
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-3xl border-2 border-line bg-surface">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.subject || "Study session"}</p>
                  <p className="text-sm text-muted">
                    {s.endedAt ? dateFormat.format(s.endedAt) : ""}
                  </p>
                </div>
                <p className="shrink-0 font-display text-lg font-bold tabular-nums">
                  {s.minutes ?? 0} min
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-cheese px-4 py-4 text-[#12203a]">
      <p className="font-display text-4xl font-extrabold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-sm font-semibold">{label} points</p>
    </div>
  );
}

function MeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile" className="space-y-4">
      <Skeleton className="h-36" />
      <Skeleton className="h-24" />
      <Skeleton className="h-56" />
    </div>
  );
}
