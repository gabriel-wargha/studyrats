"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth/client";
import { safeRedirectPath } from "@/lib/auth/next-path";

type Mode = "sign-in" | "sign-up";

const copy = {
  "sign-in": {
    title: "Welcome back",
    intro: "Log in to pick up where you left off.",
    submit: "Log in",
    busy: "Logging in...",
    switchText: "New here?",
    switchLink: "Sign up",
    switchHref: "/sign-up",
  },
  "sign-up": {
    title: "Join StudyRats",
    intro: "Make an account to start a timer and join a group.",
    submit: "Sign up",
    busy: "Creating account...",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/sign-in",
  },
} as const;

function friendlyError(mode: Mode, status?: number, message?: string): string {
  if (mode === "sign-in" && (status === 400 || status === 401)) {
    return "That email and password don't match. Check them and try again.";
  }
  if (mode === "sign-up" && (status === 409 || status === 422)) {
    return "An account with this email already exists. Log in instead.";
  }
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (message && status && status < 500) return message;
  return "Something went wrong on our side. Try again in a moment.";
}

const inputClass =
  "mt-1.5 block min-h-12 w-full rounded-xl bg-white px-4 text-lg text-ink ring-2 ring-rule placeholder:text-pencil/60 aria-[invalid=true]:ring-red-700";

export function AuthForm({ mode }: { mode: Mode }) {
  const c = copy[mode];
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const target = safeRedirectPath(next);
  const ids = { name: useId(), email: useId(), password: useId(), error: useId() };

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    if (mode === "sign-up" && !name) return setError("Enter the name your group will see.");
    if (!email) return setError("Enter your email address.");
    if (!password) return setError("Enter your password.");
    if (mode === "sign-up" && password.length < 8) {
      return setError("Use a password with at least 8 characters.");
    }

    setError(null);
    setPending(true);
    try {
      const res =
        mode === "sign-up"
          ? await signUpWithEmail({ email, password, name })
          : await signInWithEmail({ email, password });
      if (res.error) {
        setError(friendlyError(mode, res.error.status, res.error.message));
        setPending(false);
        return;
      }
      router.replace(target);
      router.refresh();
    } catch {
      setError("Can't reach StudyRats. Check your connection and try again.");
      setPending(false);
    }
  }

  const switchHref = next
    ? `${c.switchHref}?next=${encodeURIComponent(target)}`
    : c.switchHref;
  const described = error ? ids.error : undefined;

  return (
    <div className="flex min-h-dvh flex-col pt-8 pb-10">
      <Link href="/" className="font-display self-start text-xl font-bold tracking-tight">
        StudyRats
      </Link>

      <h1 className="font-display mt-12 text-[2.25rem] leading-[1.05] font-extrabold tracking-tight text-balance">
        {c.title}
      </h1>
      <p className="mt-3 max-w-[34ch] text-lg leading-snug text-pencil">{c.intro}</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {error && (
          <p
            id={ids.error}
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-900 ring-2 ring-red-700"
          >
            {error}
          </p>
        )}

        {mode === "sign-up" && (
          <div>
            <label htmlFor={ids.name} className="font-semibold">
              Display name
            </label>
            <input
              id={ids.name}
              name="name"
              type="text"
              autoComplete="name"
              maxLength={40}
              aria-invalid={!!error}
              aria-describedby={described}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor={ids.email} className="font-semibold">
            Email
          </label>
          <input
            id={ids.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={described}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={ids.password} className="font-semibold">
            Password
          </label>
          <input
            id={ids.password}
            name="password"
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            aria-invalid={!!error}
            aria-describedby={described}
            className={inputClass}
          />
          {mode === "sign-up" && (
            <p className="mt-1.5 text-sm text-pencil">At least 8 characters.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex min-h-14 items-center justify-center rounded-xl bg-highlighter px-6 text-lg font-bold text-ink ring-2 ring-ink disabled:opacity-60"
        >
          {pending ? c.busy : c.submit}
        </button>
      </form>

      <p className="mt-8 text-pencil">
        {c.switchText}{" "}
        <Link href={switchHref} className="font-bold text-ink underline underline-offset-4">
          {c.switchLink}
        </Link>
      </p>
    </div>
  );
}
