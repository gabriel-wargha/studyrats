import Link from "next/link";
import { MobileContainer } from "@/components/mobile-container";

const sample = [
  { name: "Maren", points: 412 },
  { name: "Tevita", points: 388 },
  { name: "Jo", points: 305 },
  { name: "Priya", points: 0 },
];

const steps = [
  {
    title: "Make a group, share the code",
    body: "Keep it to friends or your whole class. Only members see the group.",
  },
  {
    title: "Time it, prove it",
    body: "The timer runs on our clock, and a photo of your notes is optional.",
  },
  {
    title: "Cheer each other on",
    body: "React to check-ins in your group feed when someone puts in the hours.",
  },
];

export default function Home() {
  return (
    <MobileContainer as="main" className="flex min-h-dvh flex-col pt-8 pb-10">
      <p className="font-display text-xl font-bold tracking-tight">StudyRats</p>

      <h1 className="font-display mt-12 text-[2.75rem] leading-[1.02] font-extrabold tracking-tight text-balance">
        Study together. Every minute counts.
      </h1>
      <p className="mt-4 max-w-[34ch] text-lg leading-snug text-pencil">
        Start a timer, snap your notes, and earn a point for each minute. Your
        group sees it all on the leaderboard.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/sign-up"
          className="flex min-h-14 items-center justify-center rounded-xl bg-highlighter px-6 text-lg font-bold text-ink ring-2 ring-ink"
        >
          Sign up
        </Link>
        <Link
          href="/sign-in"
          className="flex min-h-14 items-center justify-center rounded-xl px-6 text-lg font-bold text-ink ring-2 ring-rule"
        >
          Log in
        </Link>
      </div>

      <section
        aria-labelledby="sample-title"
        className="mt-12 rounded-2xl bg-chalk p-5 text-paper"
      >
        <h2 id="sample-title" className="font-display text-lg font-bold">
          Biology 101, this week
        </h2>
        <ol className="mt-3 divide-y divide-paper/20">
          {sample.map((row, i) => (
            <li key={row.name} className="flex items-baseline gap-4 py-3">
              <span className="font-display w-5 text-xl font-bold text-highlighter">
                {i + 1}
              </span>
              <span className="flex-1 text-lg font-semibold">{row.name}</span>
              <span className="text-lg tabular-nums">
                {row.points}
                <span className="ml-1 text-sm text-paper/70">pts</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-paper/70">
          Example group. Yours starts at zero.
        </p>
      </section>

      <ul className="mt-10 space-y-5">
        {steps.map((s) => (
          <li key={s.title}>
            <h2 className="font-display text-xl font-bold">{s.title}</h2>
            <p className="mt-1 text-pencil">{s.body}</p>
          </li>
        ))}
      </ul>
    </MobileContainer>
  );
}
