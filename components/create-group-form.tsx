"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { createGroup } from "@/app/actions/groups";
import { errorClass, inputClass, primaryButton } from "@/components/ui";

const types = [
  { value: "friends", title: "Friends", hint: "A few people holding each other to it." },
  { value: "class", title: "Class", hint: "Everyone in the same course or section." },
] as const;

export function CreateGroupForm() {
  const router = useRouter();
  const ids = { name: useId(), error: useId() };
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const type = String(form.get("type") ?? "");
    if (!name) return setError("Give the group a name.");
    setError(null);
    startTransition(async () => {
      try {
        const res = await createGroup({ name, type });
        if (!res.ok) return setError(res.error);
        router.push(`/groups/${res.data.groupId}/invite`);
      } catch {
        setError("Can't reach StudyRats. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-6">
      {error && (
        <p id={ids.error} role="alert" className={errorClass}>
          {error}
        </p>
      )}

      <div>
        <label htmlFor={ids.name} className="font-semibold">
          Group name
        </label>
        <input
          id={ids.name}
          name="name"
          type="text"
          maxLength={40}
          autoComplete="off"
          placeholder="Biology 101"
          aria-invalid={!!error}
          aria-describedby={error ? ids.error : undefined}
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="font-semibold">Who is it for?</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          {types.map((t, i) => (
            <label key={t.value} className="relative block">
              <input
                type="radio"
                name="type"
                value={t.value}
                defaultChecked={i === 0}
                className="peer sr-only"
              />
              <span className="block h-full rounded-xl bg-white p-4 ring-2 ring-rule peer-checked:bg-chalk peer-checked:text-paper peer-checked:ring-ink peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                <span className="font-display block text-xl font-bold">{t.title}</span>
                <span className="mt-1 block text-sm leading-snug opacity-75">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Creating group..." : "Create group"}
      </button>
    </form>
  );
}
