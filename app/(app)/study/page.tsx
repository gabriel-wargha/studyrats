import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/skeleton";
import { StudyTimer } from "@/components/study-timer";
import { requireUser } from "@/lib/auth/server";
import { getActiveSession, getMyRecentSubjects } from "@/server/sessions";

export const metadata: Metadata = { title: "Study" };

export default function StudyPage() {
  return (
    <Suspense fallback={<StudySkeleton />}>
      <StudyContent />
    </Suspense>
  );
}

async function StudyContent() {
  await connection(); // per-request: never run auth during prerender
  const user = await requireUser("/study");
  const [active, subjects] = await Promise.all([
    getActiveSession(user.id),
    getMyRecentSubjects(user.id),
  ]);
  // Server time, taken as late as possible. The client measures elapsed time
  // from this moment, so a wrong phone clock cannot change the timer.
  const serverNow = readServerClock();

  return (
    <StudyTimer
      active={
        active
          ? { id: active.id, subject: active.subject, startedAt: active.startedAt.getTime() }
          : null
      }
      serverNow={serverNow}
      subjects={subjects}
    />
  );
}

/** Server wall clock in ms. A plain function because React's purity lint flags Date.now() in components. */
function readServerClock(): number {
  return Date.now();
}

function StudySkeleton() {
  return (
    <div role="status" aria-label="Loading the timer" className="flex flex-col gap-6">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-20" />
      <Skeleton className="h-14" />
    </div>
  );
}
