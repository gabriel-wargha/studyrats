"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { createGroup } from "@/app/actions/groups";
import { FormError, fieldClass, primaryButton, type GroupType } from "@/components/ui";

const TYPES: { value: GroupType; title: string; hint: string }[] = [
  { value: "friends", title: "Friends", hint: "People you choose to study with" },
  { value: "class", title: "Class", hint: "Classmates in one course" },
];

export function CreateGroupForm() {
  const router = useRouter();
  const ids = useId();
  const [type, setType] = useState<GroupType>("friends");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setError(null);
    setNameError(null);
    startTransition(async () => {
      try {
        const result = await createGroup({ name, type });
        if (!result.ok) {
          const fieldMessage = result.fieldErrors?.name?.[0] ?? null;
          setNameError(fieldMessage);
          setError(fieldMessage ? null : result.error);
          return;
        }
        router.push(`/groups/${result.data.groupId}/invite`);
      } catch {
        setError("Could not create the group. Check your connection and try again.");
      }
    });
  }

  const errorId = `${ids}-error`;
  const nameErrorId = `${ids}-name-error`;

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <div>
        <label htmlFor={`${ids}-name`} className="text-sm font-semibold">
          Group name
        </label>
        <input
          id={`${ids}-name`}
          name="name"
          type="text"
          required
          maxLength={40}
          autoComplete="off"
          placeholder="CS 124 study crew"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? nameErrorId : undefined}
          className={fieldClass}
        />
        <div id={nameErrorId} role="alert">
          {nameError && (
            <p className="mt-1.5 text-sm font-medium text-[#c2410c] dark:text-[#fb923c]">
              {nameError}
            </p>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Type of group</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          {TYPES.map((t) => (
            <label key={t.value} className="relative block">
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="peer sr-only"
              />
              <span className="flex min-h-24 flex-col justify-center rounded-2xl border-2 border-line bg-surface px-4 py-3 peer-checked:border-ink peer-checked:bg-cheese peer-checked:text-[#12203a] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cheese">
                <span className="font-display text-lg font-bold">{t.title}</span>
                <span className="mt-0.5 text-sm leading-5 opacity-80">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormError id={errorId} message={error} />

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Creating group..." : "Create group"}
      </button>
    </form>
  );
}
