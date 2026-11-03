import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { StudyTimer } from "@/components/study-timer";
import { PageHeader, Skeleton, pageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/server";
import { getActiveSession, getMyRecentSubjects } from "@/lib/queries/sessions";

export const metadata: Metadata = { title: "Study" };

export default function StudyPage() {
  return (
    <main className={pageShell}>
      <PageHeader title="Study" />
      <div className="mt-6 flex flex-1 flex-col">
        <Suspense fallback={<StudySkeleton />}>
          <Timer />
        </Suspense>
      </div>
    </main>
  );
}

function serverNowMs(): number {
  return Date.now();
}

async function Timer() {
  // Render at request time before touching auth or the database.
  await connection();
  const user = await requireUser("/study");
  const [active, subjects] = await Promise.all([
    getActiveSession(user.id),
    getMyRecentSubjects(user.id),
  ]);

  return (
    <StudyTimer
      // Server clock at render time. The client uses it to correct for a wrong phone clock.
      serverNow={serverNowMs()}
      subjects={subjects}
      active={
        active
          ? { id: active.id, subject: active.subject, startedAt: active.startedAt.getTime() }
          : null
      }
    />
  );
}

function StudySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading timer" className="space-y-4">
      <Skeleton className="h-12" />
      <Skeleton className="h-56 rounded-3xl" />
      <Skeleton className="h-16" />
    </div>
  );
}
