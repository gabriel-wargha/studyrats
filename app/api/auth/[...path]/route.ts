import { getAuth } from "@/lib/auth/server";

type Ctx = { params: Promise<{ path: string[] }> };

// The SDK is built on the first request, never at import time.
const handle =
  (method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH") =>
  (request: Request, ctx: Ctx) =>
    getAuth().handler()[method](request, ctx);

export const GET = handle("GET");
export const POST = handle("POST");
export const PUT = handle("PUT");
export const DELETE = handle("DELETE");
export const PATCH = handle("PATCH");
