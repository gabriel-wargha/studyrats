"use client";

import { RouteError } from "@/components/route-error";

export default function GroupsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} />;
}
