"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRecurrenceTemplateAction } from "@/lib/actions/recurrence";
import { DAY_NAMES } from "@/lib/constants";
import { MONTH_END_CLAMP_NOTICE } from "@/lib/recurrence/types";
import {
  FormField,
  inputClassName,
  PrimaryButton,
} from "@/components/forms/ui";

export function RecurrenceTemplateForm({ cancelHref }: { cancelHref: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfMonth, setDayOfMonth] = useState(1);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const firstDate = String(formData.get("firstOccurrenceDate") ?? "");
    const estimate = formData.get("estimate")
      ? Number(formData.get("estimate"))
      : null;
    const endDate = String(formData.get("endDate") ?? "") || null;

    let recurrenceRule: unknown;
    if (frequency === "daily") {
      recurrenceRule = { frequency: "daily", interval: 1 };
    } else if (frequency === "weekdays") {
      recurrenceRule = { frequency: "weekdays" };
    } else if (frequency === "monthly") {
      recurrenceRule = {
        frequency: "monthly",
        monthlyMode: "day_of_month",
        dayOfMonth,
        interval: 1,
      };
    } else {
      recurrenceRule = {
        frequency: "weekly",
        interval: 1,
        byWeekday: selectedDays.length > 0 ? selectedDays : [1],
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
        endDate,
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
        <select
          id="frequency"
          name="frequency"
          className={inputClassName}
          value={frequency}
          onChange={(event) => setFrequency(event.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly on selected days</option>
          <option value="monthly">Monthly by day of month</option>
        </select>
      </FormField>

      {frequency === "weekly" && (
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
      )}

      {frequency === "monthly" && (
        <div className="space-y-2">
          <FormField label="Day of month" htmlFor="dayOfMonth">
            <input
              id="dayOfMonth"
              name="dayOfMonth"
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(Number(event.target.value))}
              className={inputClassName}
            />
          </FormField>
          {dayOfMonth >= 29 && (
            <p className="text-xs text-muted">{MONTH_END_CLAMP_NOTICE}</p>
          )}
        </div>
      )}

      <FormField label="First occurrence" htmlFor="firstOccurrenceDate">
        <input
          id="firstOccurrenceDate"
          name="firstOccurrenceDate"
          type="date"
          required
          className={inputClassName}
        />
      </FormField>

      <FormField label="End date (optional)" htmlFor="endDate">
        <input id="endDate" name="endDate" type="date" className={inputClassName} />
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
