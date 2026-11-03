"use client";

import { createAuthClient } from "@neon/auth/next";

type AuthClient = ReturnType<typeof createAuthClient>;

let client: AuthClient | undefined;

/** Builds the browser client on first call (talks to /api/auth on the same origin). */
export function getAuthClient(): AuthClient {
  client ??= createAuthClient();
  return client;
}

export function signUpWithEmail(input: { email: string; password: string; name: string }) {
  return getAuthClient().signUp.email(input);
}

export function signInWithEmail(input: { email: string; password: string }) {
  return getAuthClient().signIn.email(input);
}

export function signOut() {
  return getAuthClient().signOut();
}
