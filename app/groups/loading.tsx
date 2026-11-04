import { Skeleton, pageShell } from "@/components/ui";

export default function GroupsLoading() {
  return (
    <div className={pageShell} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-6 h-12" />
      <Skeleton className="mt-3 h-12" />
      <Skeleton className="mt-8 h-20 rounded-3xl" />
      <Skeleton className="mt-3 h-20 rounded-3xl" />
    </div>
  );
}
