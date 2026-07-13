"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRecurrenceTemplateAction } from "@/lib/actions/recurrence";
import { DAY_NAMES } from "@/lib/constants";
import {
  FormField,
  inputClassName,
  PrimaryButton,
} from "@/components/forms/ui";

export function RecurrenceTemplateForm({ cancelHref }: { cancelHref: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([0]);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function handleSubmit(formData: FormData) {
    const frequency = String(formData.get("frequency") ?? "weekly");
    const title = String(formData.get("title") ?? "");
    const firstDate = String(formData.get("firstOccurrenceDate") ?? "");
    const estimate = formData.get("estimate")
      ? Number(formData.get("estimate"))
      : null;

    let recurrenceRule: unknown;
    if (frequency === "daily") {
      recurrenceRule = { frequency: "daily", interval: 1 };
    } else if (frequency === "weekdays") {
      recurrenceRule = { frequency: "weekdays" };
    } else {
      recurrenceRule = {
        frequency: "weekly",
        interval: 1,
        byWeekday: selectedDays.length > 0 ? selectedDays : [0],
      };
    }

    startTransition(async () => {
      setError(null);
      const result = await createRecurrenceTemplateAction({
        title,
        recurrenceRule,
        firstOccurrenceDate: firstDate,
        defaultEstimateMinutes: estimate,
        byWeekday: frequency === "weekly" ? selectedDays : undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push("/tasks/recurring");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="max-w-lg space-y-4">
      <FormField label="Title" htmlFor="title">
        <input id="title" name="title" required className={inputClassName} />
      </FormField>

      <FormField label="Frequency" htmlFor="frequency">
        <select id="frequency" name="frequency" className={inputClassName}>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly on selected days</option>
        </select>
      </FormField>

      <div className="flex flex-wrap gap-2">
        {DAY_NAMES.map((name, index) => (
          <button
            key={name}
            type="button"
            onClick={() => toggleDay(index)}
            className={`rounded-full border px-3 py-1 text-xs ${
              selectedDays.includes(index)
                ? "border-accent text-accent"
                : "border-border text-muted"
            }`}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      <FormField label="First occurrence" htmlFor="firstOccurrenceDate">
        <input
          id="firstOccurrenceDate"
          name="firstOccurrenceDate"
          type="date"
          required
          className={inputClassName}
        />
      </FormField>

      <FormField label="Default estimate (minutes)" htmlFor="estimate">
        <input
          id="estimate"
          name="estimate"
          type="number"
          min={0}
          className={inputClassName}
        />
      </FormField>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create template"}
        </PrimaryButton>
        <Link
          href={cancelHref}
          className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
