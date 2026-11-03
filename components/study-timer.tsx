"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { startSession, stopSession, updateSubject } from "@/app/actions/sessions";
import { PhotoPicker } from "@/components/photo-picker";
import { FormError, fieldClass, outlineButton } from "@/components/ui";
import { elapsedSeconds, formatClock, isPastCap } from "@/lib/clock";

type Active = { id: string; subject: string | null; startedAt: number };
type Done = { sessionId: string; subject: string | null; minutes: number; capped: boolean };

const bigButton =
  "flex min-h-20 w-full items-center justify-center rounded-3xl px-6 font-display text-2xl font-extrabold tracking-tight disabled:opacity-60";

export function StudyTimer({
  serverNow,
  subjects,
  active,
}: {
  serverNow: number;
  subjects: string[];
  active: Active | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState<Active | null>(active);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const errorId = useId();

  // Server time minus phone time. The first paint uses the server's own "now"
  // so it matches the server render, then the offset is corrected once mounted.
  const offsetRef = useRef(0);
  const [nowMs, setNowMs] = useState(serverNow);

  useEffect(() => {
    offsetRef.current = serverNow - Date.now();
    const tick = () => setNowMs(Date.now() + offsetRef.current);
    const interval = window.setInterval(tick, 1000);
    // Phones freeze timers in the background, so recompute when the page returns.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [serverNow]);

  function onStart() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await startSession({ subject });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const { id, subject: saved, startedAt } = result.data;
        setRunning({ id, subject: saved, startedAt: new Date(startedAt).getTime() });
        setSubject("");
      } catch {
        setError("Could not start the timer. Check your connection and try again.");
      }
    });
  }

  function onStop() {
    if (pending || !running) return;
    setError(null);
    const current = running;
    startTransition(async () => {
      try {
        const result = await stopSession({ id: current.id });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setRunning(null);
        setDone({ sessionId: current.id, subject: current.subject, ...result.data });
      } catch {
        setError("Could not stop the timer. Check your connection and try again.");
      }
    });
  }

  function onAgain() {
    setDone(null);
    setError(null);
    router.refresh(); // reload the recent subjects
  }

  if (running) {
    const seconds = elapsedSeconds(running.startedAt, nowMs);
    const minutes = Math.floor(seconds / 60);
    return (
      <div className="flex flex-1 flex-col gap-5">
        <section
          aria-label="Timer running"
          className="rounded-3xl border-2 border-ink bg-surface px-4 py-10 text-center"
        >
          <p className="text-sm font-semibold text-muted">Studying now</p>
          <p
            role="timer"
            aria-live="off"
            className="mt-2 font-display text-[3.75rem] font-extrabold leading-none tracking-tight tabular-nums"
          >
            {formatClock(seconds)}
          </p>
          <p className="mt-3 text-sm text-muted">
            {minutes} {minutes === 1 ? "minute" : "minutes"} so far
          </p>
          {isPastCap(seconds) && (
            <p className="mx-auto mt-3 max-w-[30ch] text-sm font-semibold">
              Capped at 6 hours. Time after this will not earn points.
            </p>
          )}
        </section>

        <SubjectField
          key={running.id}
          sessionId={running.id}
          initial={running.subject}
          subjects={subjects}
        />

        <PhotoPicker key={running.id} sessionId={running.id} />

        <div className="mt-auto space-y-3">
          <FormError id={errorId} message={error} />
          <button
            type="button"
            onClick={onStop}
            disabled={pending}
            className={bigButton + " bg-ink text-background"}
          >
            {pending ? "Stopping..." : "Stop studying"}
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const tooShort = done.minutes === 0;
    return (
      <div className="flex flex-1 flex-col gap-5">
        <section
          aria-label="Session finished"
          aria-live="polite"
          className="rounded-3xl border-2 border-ink bg-surface px-4 py-10 text-center"
        >
          {tooShort ? (
            <>
              <h2 className="font-display text-3xl font-extrabold tracking-tight">
                Too short to count
              </h2>
              <p className="mx-auto mt-2 max-w-[30ch] text-base text-muted">
                Sessions under 1 minute are not saved. Start again when you are ready.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-muted">You earned</p>
              <p className="mt-2 font-display text-[3.75rem] font-extrabold leading-none tracking-tight tabular-nums">
                {done.minutes}
              </p>
              <p className="mt-2 text-base font-semibold">
                {done.minutes === 1 ? "point" : "points"} for {done.minutes}{" "}
                {done.minutes === 1 ? "minute" : "minutes"} of study
              </p>
              {done.capped && (
                <p className="mx-auto mt-3 max-w-[30ch] text-sm text-muted">
                  Capped at 6 hours. Time after that did not earn points.
                </p>
              )}
            </>
          )}
        </section>

        {!tooShort && (
          <>
            <SubjectField
              key={done.sessionId}
              sessionId={done.sessionId}
              initial={done.subject}
              subjects={subjects}
            />
            <PhotoPicker key={done.sessionId} sessionId={done.sessionId} />
          </>
        )}

        <div className="mt-auto space-y-3">
          {!tooShort && (
            <Link href="/groups" className={outlineButton}>
              See feed
            </Link>
          )}
          <button
            type="button"
            onClick={onAgain}
            className={bigButton + " bg-cheese text-[#12203a]"}
          >
            Start another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <label htmlFor="subject" className="text-base font-semibold">
          What are you studying?
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          list="recent-subjects"
          maxLength={60}
          autoComplete="off"
          enterKeyHint="go"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Optional, like Math 221"
          aria-describedby={error ? errorId : undefined}
          className={fieldClass}
        />
        <datalist id="recent-subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <div className="mt-auto space-y-3">
        <FormError id={errorId} message={error} />
        <button
          type="button"
          onClick={onStart}
          disabled={pending}
          className={bigButton + " bg-cheese text-[#12203a]"}
        >
          {pending ? "Starting..." : "Start studying"}
        </button>
      </div>
    </div>
  );
}

/** Edits the subject of a session; saves when the field loses focus. */
function SubjectField({
  sessionId,
  initial,
  subjects,
}: {
  sessionId: string;
  initial: string | null;
  subjects: string[];
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const id = useId();
  const listId = `${id}-list`;

  async function save() {
    const next = value.trim();
    if (next === saved) return;
    setStatus("saving");
    try {
      const result = await updateSubject({ id: sessionId, subject: next });
      if (!result.ok) {
        setStatus("error");
        return;
      }
      setSaved(result.data.subject ?? "");
      setValue(result.data.subject ?? "");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <label htmlFor={id} className="text-base font-semibold">
        Subject
      </label>
      <input
        id={id}
        type="text"
        list={listId}
        maxLength={60}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
        onBlur={save}
        placeholder="Optional, like Math 221"
        className={fieldClass}
      />
      <datalist id={listId}>
        {subjects.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p role="status" className="mt-1.5 min-h-5 text-sm text-muted">
        {status === "saving" && "Saving..."}
        {status === "saved" && "Subject saved"}
        {status === "error" && "Could not save the subject. Try again."}
      </p>
    </div>
  );
}
