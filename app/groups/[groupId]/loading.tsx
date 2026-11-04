import { Skeleton } from "@/components/ui";

export default function GroupPageLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="mt-4 h-32 rounded-3xl" />
    </div>
  );
}
