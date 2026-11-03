import Link from "next/link";

const buttonBase =
  "flex min-h-12 w-full items-center justify-center rounded-2xl px-6 text-base font-semibold";

const points = [
  "Join a group with an invite code.",
  "Time each session and add a photo of your notes.",
  "Cheer on check-ins and climb the leaderboard.",
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <p className="font-display text-xl font-bold tracking-tight">StudyRats</p>

      <section className="my-auto py-12">
        <h1 className="font-display text-[3.25rem] font-extrabold leading-[0.95] tracking-tight">
          One minute studied. One point earned.
        </h1>
        <p className="mt-6 max-w-[34ch] text-lg leading-7 text-muted">
          Start a timer, snap your notes, and see how your friends or your
          class are doing this week. Built for BYU-Idaho students.
        </p>

        <ul className="mt-8 space-y-3 text-base">
          {points.map((text) => (
            <li key={text} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-2 size-2.5 shrink-0 rounded-full bg-cheese"
              />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <Link
          href="/sign-up"
          className={buttonBase + " bg-cheese text-[#12203a]"}
        >
          Sign up
        </Link>
        <Link
          href="/sign-in"
          className={buttonBase + " border-2 border-ink text-foreground"}
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
