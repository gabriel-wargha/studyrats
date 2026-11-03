import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

// Convenience redirect only. The real check is requireUser() on the server.
export default async function proxy(request: NextRequest) {
  const res = await getAuth().middleware({ loginUrl: "/sign-in" })(request);
  const location = res.headers.get("location");
  if (location && new URL(location, request.url).pathname === "/sign-in") {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    res.headers.set("location", url.toString());
  }
  return res;
}

export const config = {
  matcher: ["/groups/:path*", "/study", "/me", "/join/:path*"],
};
