"use client";

import { RouteError } from "@/components/route-error";

// Sits inside the group layout, so the header and tabs stay visible.
export default function GroupError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} bare />;
}
