"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { resolveNextPath, withNext } from "@/lib/auth/next-path";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth/client";

type Mode = "sign-in" | "sign-up";

const COPY = {
  "sign-in": {
    title: "Welcome back",
    lead: "Log in to pick up where your minutes left off.",
    submit: "Log in",
    pending: "Logging in",
    switchText: "New to StudyRats?",
    switchLink: "Sign up",
    switchHref: "/sign-up",
  },
  "sign-up": {
    title: "Join the pack",
    lead: "Make an account, then create or join a group.",
    submit: "Sign up",
    pending: "Creating account",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/sign-in",
  },
} as const;

type AuthError = { message?: string; code?: string; status?: number } | null | undefined;

/** Turns an SDK error into a message that says what to fix. */
function friendlyError(mode: Mode, error: AuthError): string {
  const code = (error?.code ?? "").toUpperCase();
  const text = (error?.message ?? "").toLowerCase();
  if (code.includes("USER_ALREADY_EXISTS") || text.includes("already exists")) {
    return "That email already has an account. Log in instead.";
  }
  if (code.includes("INVALID_EMAIL_OR_PASSWORD") || error?.status === 401) {
    return "Email or password is wrong. Check both and try again.";
  }
  if (code.includes("PASSWORD_TOO_SHORT") || text.includes("too short")) {
    return "Use a password with at least 8 characters.";
  }
  if (code.includes("INVALID_EMAIL") || text.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (error?.status === 429) return "Too many tries. Wait a minute, then try again.";
  if (error?.message && (error.status ?? 500) < 500) return error.message;
  return mode === "sign-in"
    ? "Could not log you in. Check your connection and try again."
    : "Could not create your account. Check your connection and try again.";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const ids = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    setPending(true);
    setError(null);
    try {
      const result =
        mode === "sign-up"
          ? await signUpWithEmail({ email, password, name: name || email.split("@")[0] })
          : await signInWithEmail({ email, password });
      if (result.error) {
        setError(friendlyError(mode, result.error));
        setPending(false);
        return;
      }
      router.replace(resolveNextPath(nextParam));
      router.refresh();
    } catch {
      setError(friendlyError(mode, null));
      setPending(false);
    }
  }

  const field =
    "mt-1.5 block min-h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-base text-foreground placeholder:text-muted/70 focus:border-ink";
  const errorId = `${ids}-error`;

  return (
    <main className="flex flex-1 flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="font-display text-xl font-bold tracking-tight">
        StudyRats
      </Link>

      <section className="my-auto py-10">
        <h1 className="font-display text-[2.5rem] font-extrabold leading-[0.98] tracking-tight">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-[34ch] text-base leading-6 text-muted">{copy.lead}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {mode === "sign-up" && (
            <div>
              <label htmlFor={`${ids}-name`} className="text-sm font-semibold">
                Display name
              </label>
              <input
                id={`${ids}-name`}
                name="name"
                type="text"
                autoComplete="name"
                maxLength={40}
                placeholder="How your group sees you"
                className={field}
              />
            </div>
          )}
          <div>
            <label htmlFor={`${ids}-email`} className="text-sm font-semibold">
              Email
            </label>
            <input
              id={`${ids}-email`}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={field}
            />
          </div>
          <div>
            <label htmlFor={`${ids}-password`} className="text-sm font-semibold">
              Password
            </label>
            <input
              id={`${ids}-password`}
              name="password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              required
              minLength={mode === "sign-up" ? 8 : undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={field}
            />
            {mode === "sign-up" && (
              <p className="mt-1.5 text-sm text-muted">At least 8 characters.</p>
            )}
          </div>

          <div id={errorId} role="alert">
            {error && (
              <p className="rounded-2xl border-2 border-[#c2410c] bg-surface px-4 py-3 text-sm font-medium text-[#c2410c] dark:border-[#fb923c] dark:text-[#fb923c]">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-cheese px-6 text-base font-semibold text-[#12203a] disabled:opacity-60"
          >
            {pending ? `${copy.pending}...` : copy.submit}
          </button>
        </form>

        <p className="mt-6 text-center text-base text-muted">
          {copy.switchText}{" "}
          <Link
            href={withNext(copy.switchHref, nextParam)}
            className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4"
          >
            {copy.switchLink}
          </Link>
        </p>
      </section>
    </main>
  );
}
