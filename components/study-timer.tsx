"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { startSession, stopSession, updateSubject } from "@/app/actions/sessions";
import { PhotoPicker } from "@/components/photo-picker";
import { errorClass, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { MAX_SESSION_MINUTES } from "@/lib/points";

type Active = { id: string; subject: string | null; startedAt: number };
type Done = {
  minutes: number;
  capped: boolean;
  discarded: boolean;
  subject: string | null;
  sessionId: string;
};

const NETWORK_ERROR = "Can't reach StudyRats. Check your connection and try again.";

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? h + ":" + pad(m) + ":" + pad(s % 60) : pad(m) + ":" + pad(s % 60);
}

export function StudyTimer({
  active,
  serverNow,
  subjects,
}: {
  active: Active | null;
  /** Server time (ms) when this page was rendered. */
  serverNow: number;
  subjects: string[];
}) {
  const [done, setDone] = useState<Done | null>(null);
  // Session ids that got a photo. Kept here because the running view remounts
  // when the page refreshes after a photo is attached.
  const [photoFor, setPhotoFor] = useState<string[]>([]);
  const markPhoto = (id: string) => setPhotoFor((p) => (p.includes(id) ? p : [...p, id]));

  if (done) {
    return (
      <DoneView
        done={done}
        hasPhoto={photoFor.includes(done.sessionId)}
        onPhoto={() => markPhoto(done.sessionId)}
        onAgain={() => setDone(null)}
      />
    );
  }
  if (active) {
    // Keyed on the session id only. A refresh (tab returns, revalidation after
    // a photo) must not remount, or the photo picker would lose its upload
    // progress and retry state. The clock re-syncs through props instead.
    return (
      <RunningView
        key={active.id}
        active={active}
        serverNow={serverNow}
        hasPhoto={photoFor.includes(active.id)}
        onPhoto={() => markPhoto(active.id)}
        onDone={setDone}
      />
    );
  }
  return <IdleView subjects={subjects} />;
}

function IdleView({ subjects }: { subjects: string[] }) {
  const ids = { subject: useId(), list: useId(), error: useId() };
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await startSession({ subject });
        if (!res.ok) setError(res.error);
        // On success the action revalidates /study and the page re-renders as running.
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight">
          Ready to study?
        </h1>
        <p className="mt-3 max-w-[34ch] text-lg leading-snug text-pencil">
          Every full minute is a point for you in each of your groups.
        </p>
      </div>

      {error && (
        <p id={ids.error} role="alert" className={errorClass}>
          {error}
        </p>
      )}

      <div>
        <label htmlFor={ids.subject} className="font-semibold">
          Subject (optional)
        </label>
        <input
          id={ids.subject}
          type="text"
          list={subjects.length ? ids.list : undefined}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={60}
          autoComplete="off"
          placeholder="Biology 101"
          aria-invalid={!!error}
          aria-describedby={error ? ids.error : undefined}
          className={inputClass}
        />
        {subjects.length > 0 && (
          <>
            <datalist id={ids.list}>
              {subjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Recent subjects">
              {subjects.slice(0, 4).map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setSubject(s)}
                    className="min-h-11 rounded-full px-4 font-semibold ring-2 ring-rule"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Starting..." : "Start studying"}
      </button>
    </form>
  );
}

function RunningView({
  active,
  serverNow,
  hasPhoto,
  onPhoto,
  onDone,
}: {
  active: Active;
  serverNow: number;
  hasPhoto: boolean;
  onPhoto: () => void;
  onDone: (d: Done) => void;
}) {
  const router = useRouter();
  const ids = { subject: useId(), error: useId() };
  const [subject, setSubject] = useState(active.subject ?? "");
  const [savedSubject, setSavedSubject] = useState(active.subject ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Elapsed seconds as measured by the server when it rendered this page.
  const baseSeconds = (serverNow - active.startedAt) / 1000;
  const [seconds, setSeconds] = useState(baseSeconds);
  // New server time arrived (refresh): re-sync right away, during render.
  const [syncedBase, setSyncedBase] = useState(baseSeconds);
  if (syncedBase !== baseSeconds) {
    setSyncedBase(baseSeconds);
    setSeconds(baseSeconds);
  }

  useEffect(() => {
    // performance.now() ignores phone clock changes. Elapsed = server-measured
    // time at render + time passed on this device since mount.
    const anchor = performance.now();
    const id = window.setInterval(() => {
      setSeconds(baseSeconds + (performance.now() - anchor) / 1000);
    }, 1000);
    // Timers freeze in the background on phones, so ask the server for fresh
    // time when the tab comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [baseSeconds, router]);

  const overCap = seconds >= MAX_SESSION_MINUTES * 60;
  const shortOfMinute = seconds < 60;

  function saveSubject() {
    if (subject.trim() === savedSubject.trim()) return;
    startTransition(async () => {
      try {
        const res = await updateSubject(active.id, subject);
        if (res.ok) {
          setSavedSubject(res.data.subject ?? "");
          setError(null);
        } else setError(res.error);
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  function onStop() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        // Save a pending subject edit first so it is on the finished session.
        let finalSubject = savedSubject.trim() || null;
        if (subject.trim() !== savedSubject.trim()) {
          const s = await updateSubject(active.id, subject);
          if (s.ok) finalSubject = s.data.subject;
        }
        const res = await stopSession(active.id);
        if (!res.ok) return setError(res.error);
        onDone({
          minutes: res.data.minutes,
          capped: res.data.capped,
          discarded: res.data.discarded,
          subject: finalSubject,
          sessionId: active.id,
        });
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight">
        Studying
      </h1>

      <section className="rounded-2xl bg-chalk p-6 text-paper" aria-label="Elapsed time">
        {/* Not a live region: announcing every second would be noise. */}
        <p className="font-display text-[3.5rem] leading-none font-extrabold tabular-nums">
          {formatClock(seconds)}
        </p>
        <p className="mt-3 text-paper/80">
          {overCap
            ? "Capped at 6 hours. Time past this does not count."
            : shortOfMinute
              ? "Under a minute does not count yet."
              : Math.floor(seconds / 60) + " points so far."}
        </p>
      </section>

      {error && (
        <p id={ids.error} role="alert" className={errorClass}>
          {error}
        </p>
      )}

      <div>
        <label htmlFor={ids.subject} className="font-semibold">
          Subject
        </label>
        <input
          id={ids.subject}
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onBlur={saveSubject}
          maxLength={60}
          autoComplete="off"
          placeholder="What are you working on?"
          aria-describedby={error ? ids.error : undefined}
          className={inputClass}
        />
      </div>

      <div data-slot="photo-picker-running">
        <PhotoPicker sessionId={active.id} attached={hasPhoto} onAttached={onPhoto} />
      </div>

      <button type="button" onClick={onStop} disabled={pending} className={primaryButton}>
        {pending ? "Saving..." : "Stop and save"}
      </button>
    </div>
  );
}

function DoneView({
  done,
  hasPhoto,
  onPhoto,
  onAgain,
}: {
  done: Done;
  hasPhoto: boolean;
  onPhoto: () => void;
  onAgain: () => void;
}) {
  if (done.discarded) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight">
          Too short to count
        </h1>
        <p role="status" className="max-w-[34ch] text-lg leading-snug text-pencil">
          A session needs at least one full minute to earn a point, so this one was not saved.
        </p>
        <button type="button" onClick={onAgain} className={primaryButton}>
          Start again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight">
        Session saved
      </h1>
      <section role="status" className="rounded-2xl bg-chalk p-6 text-paper">
        <p className="font-display text-[3.5rem] leading-none font-extrabold tabular-nums">
          +{done.minutes}
        </p>
        <p className="mt-3 text-paper/80">
          {done.minutes === 1 ? "point" : "points"}
          {done.subject ? " for " + done.subject : ""}
        </p>
        {done.capped && (
          <p className="mt-3 rounded-lg bg-highlighter px-3 py-2 font-semibold text-ink">
            Capped at 6 hours. Time past that was not counted.
          </p>
        )}
      </section>

      <div data-slot="photo-picker-done">
        <PhotoPicker sessionId={done.sessionId} attached={hasPhoto} onAttached={onPhoto} />
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/groups" className={primaryButton}>
          See your groups
        </Link>
        <button type="button" onClick={onAgain} className={secondaryButton}>
          Start another session
        </button>
      </div>
    </div>
  );
}
