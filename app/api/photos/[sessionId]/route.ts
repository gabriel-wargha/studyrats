import { requireUser } from "@/lib/auth/server";
import { getPhotoUrl } from "@/server/photos";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  const { sessionId } = await ctx.params;
  const user = await requireUser("/");
  const url = await getPhotoUrl(user.id, sessionId);
  if (!url) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  // The signed URL expires in 5 minutes, so the redirect must never be shared or cached for long.
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, max-age=60" },
  });
}
